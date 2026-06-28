import { existsSync, readdirSync } from 'fs'
import { execFileSync } from 'child_process'
import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

const { Client, LocalAuth } = pkg

const getChromePath = () => {
  const cacheDir = '/opt/render/.cache/puppeteer/chrome'

  try {
    if (existsSync(cacheDir)) {
      const versions = readdirSync(cacheDir)
      for (const version of versions) {
        const p = `${cacheDir}/${version}/chrome-linux64/chrome`
        if (existsSync(p)) {
          console.log('✅ Chrome found at:', p)
          return p
        }
      }
    }
  } catch (e) {
    console.log('Cache search failed:', e.message)
  }

  // Fallback: try known system chrome binaries one by one
  for (const bin of ['google-chrome-stable', 'google-chrome', 'chromium']) {
    try {
      const p = execFileSync('which', [bin]).toString().trim()
      if (p) {
        console.log('✅ Chrome fallback at:', p)
        return p
      }
    } catch {}
  }

  console.warn('⚠️  No Chrome found — puppeteer will use its own detection')
  return undefined
}

export function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: '248-snooker',
      dataPath: '/opt/render/project/src/whatsapp-bot/.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      executablePath: getChromePath(),
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

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp disconnected:', reason)
  })

  return client
}
