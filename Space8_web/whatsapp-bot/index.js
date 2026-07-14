import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import express from 'express'
import { spawn } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import 'dotenv/config'
import { createOTP, formatOTPMessage } from './src/otp.js'
import { markAwaitingOTP } from './src/state.js'
import {
  sendBookingConfirmation,
  sendReminder,
  sendSessionEnding,
  sendAdminNewBooking,
} from './src/notifications.js'

const { Client, LocalAuth } = pkg

const app = express()
app.use(express.json())

const CHROME_DIR = '/opt/render/project/src/whatsapp-bot/.chrome/chrome'

function findChrome() {
  try {
    if (existsSync(CHROME_DIR)) {
      const versions = readdirSync(CHROME_DIR)
      for (const v of versions) {
        const p = `${CHROME_DIR}/${v}/chrome-linux64/chrome`
        if (existsSync(p)) return p
      }
    }
  } catch {}
  return null
}

function downloadChrome() {
  return new Promise((resolve, reject) => {
    console.log('📥 Downloading Chrome...')
    const proc = spawn(
      'npx',
      ['puppeteer', 'browsers', 'install', 'chrome', '--path', '/opt/render/project/src/whatsapp-bot/.chrome'],
      { stdio: 'inherit', shell: true }
    )
    proc.on('close', (code) => {
      console.log('Chrome download finished, code:', code)
      resolve()
    })
    proc.on('error', reject)
  })
}

// ── Health check (always available) ───────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Auth helpers ───────────────────────────────────────────────────────────

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

// ── API routes ─────────────────────────────────────────────────────────────

let client = null

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

    if (phone) await sendBookingConfirmation(client, phone, booking)

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API server running on port ${PORT}`)
  initWhatsApp()
})

async function initWhatsApp() {
  let chromePath = findChrome()

  if (!chromePath) {
    await downloadChrome()
    chromePath = findChrome()
  }

  console.log('✅ Chrome path:', chromePath)

  // Create client only after chromePath is known
  client = new Client({
    authStrategy: new LocalAuth({
      clientId: '248-snooker',
      dataPath: '/opt/render/project/src/whatsapp-bot/.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  })

  client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code in WhatsApp:\n')
    qrcode.generate(qr, { small: true })
  })

  client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!')
  })

  client.on('auth_failure', (message) => {
    console.error('WhatsApp auth failure:', message)
  })

  client.on('message', async (msg) => {
    try {
      const { handleMessage } = await import('./src/handler.js')
      await handleMessage(client, msg)
    } catch (err) {
      console.error('Message handling error:', err.message)
    }
  })

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp disconnected:', reason)
    setTimeout(() => initWhatsApp(), 30000)
  })

  console.log('🔄 Initializing WhatsApp client...')
  client.initialize()
}
