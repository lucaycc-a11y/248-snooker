import express from 'express'
import 'dotenv/config'
import { existsSync, readdirSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import { createWhatsAppClient } from './src/client.js'
import { handleMessage } from './src/handler.js'
import {
  sendBookingConfirmation,
  sendReminder,
  sendSessionEnding,
  sendAdminNewBooking,
} from './src/notifications.js'
import { createOTP, formatOTPMessage } from './src/otp.js'
import { markAwaitingOTP } from './src/state.js'

const CHROME_DIR = '/opt/render/project/src/whatsapp-bot/.chrome'

const findFile = (dir, name) => {
  try {
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`
      try {
        if (entry === name && statSync(full).isFile()) return full
        if (statSync(full).isDirectory()) {
          const found = findFile(full, name)
          if (found) return found
        }
      } catch {}
    }
  } catch {}
  return null
}

const ensureChrome = () => {
  const existing = findFile(CHROME_DIR, 'chrome')
  if (existing) {
    console.log('✅ Chrome already exists at:', existing)
    return existing
  }

  console.log('📥 Downloading Chrome to', CHROME_DIR, '...')
  spawnSync(
    'npx',
    ['puppeteer', 'browsers', 'install', 'chrome', '--path', CHROME_DIR],
    { stdio: 'inherit' }
  )

  const downloaded = findFile(CHROME_DIR, 'chrome')
  if (downloaded) {
    console.log('✅ Chrome downloaded to:', downloaded)
    return downloaded
  }

  console.warn('⚠️  Chrome download failed — puppeteer will attempt its own detection')
  return undefined
}

// ── Express setup ──────────────────────────────────────────────────────────

const app = express()
app.use(express.json())

let client = null

function verifySecret(req, res, next) {
  const secret = req.headers['x-webhook-secret']
  if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

function cleanHongKongPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.replace(/^852/, '')
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: client?.info ? 'connected' : 'disconnected',
  })
})

app.post('/api/send-otp', verifySecret, async (req, res) => {
  try {
    const cleanPhone = cleanHongKongPhone(req.body.phone)
    if (!/^\d{8}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Valid Hong Kong phone required' })
    }

    const fullPhone = `852${cleanPhone}`
    const code = await createOTP(cleanPhone)
    const message = formatOTPMessage(code)

    markAwaitingOTP(fullPhone)
    await client.sendMessage(`${fullPhone}@c.us`, message)

    return res.json({ success: true, expires_in: 300 })
  } catch (error) {
    console.error('Failed to send OTP:', error.message)
    return res.status(500).json({ error: 'Failed to send OTP' })
  }
})

app.post('/api/notify/booking-confirmed', verifySecret, async (req, res) => {
  try {
    const { phone, booking, adminPhones } = req.body
    if (!booking) return res.status(400).json({ error: 'Booking required' })

    if (phone) {
      await sendBookingConfirmation(client, phone, booking)
    }

    const admins = adminPhones || (process.env.ADMIN_PHONES || '').split(',').filter(Boolean)
    await sendAdminNewBooking(client, admins, booking)

    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to send booking notification:', error.message)
    return res.status(500).json({ error: 'Failed to send notification' })
  }
})

app.post('/api/notify/reminder', verifySecret, async (req, res) => {
  try {
    const { phone, booking, minutesBefore } = req.body
    if (!phone || !booking) return res.status(400).json({ error: 'Phone and booking required' })

    await sendReminder(client, phone, booking, minutesBefore)
    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to send reminder:', error.message)
    return res.status(500).json({ error: 'Failed to send reminder' })
  }
})

app.post('/api/notify/session-ending', verifySecret, async (req, res) => {
  try {
    const { phone, booking } = req.body
    if (!phone || !booking) return res.status(400).json({ error: 'Phone and booking required' })

    await sendSessionEnding(client, phone, booking)
    return res.json({ success: true })
  } catch (error) {
    console.error('Failed to send session ending notification:', error.message)
    return res.status(500).json({ error: 'Failed to send notification' })
  }
})

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`)
  initWhatsApp()
})

function initWhatsApp() {
  console.log('📥 Setting up Chrome...')
  const chromePath = ensureChrome()

  client = createWhatsAppClient(chromePath)

  client.on('message', async (msg) => {
    try {
      await handleMessage(client, msg)
    } catch (error) {
      console.error('Message handling error:', error.message)
    }
  })

  client.initialize()
}
