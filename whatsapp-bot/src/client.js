import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'
import { execSync } from 'child_process'

const { Client, LocalAuth } = pkg

function getChromePath() {
  try {
    return execSync('which chromium-browser || which chromium || which google-chrome')
      .toString().trim()
  } catch {
    return undefined
  }
}

export function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: '248-snooker',
      dataPath: '/opt/render/project/src/whatsapp-bot/.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || getChromePath(),
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
