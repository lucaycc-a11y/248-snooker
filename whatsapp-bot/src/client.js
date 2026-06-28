import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

const { Client, LocalAuth } = pkg

export function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: '248-snooker',
      dataPath: '/opt/render/project/src/whatsapp-bot/.wwebjs_auth',
    }),
    puppeteer: {
      headless: true,
      // Pin to Chrome 121 path — matches puppeteer 21.6.1 which downloads this exact build
      executablePath: '/opt/render/.cache/puppeteer/chrome/linux-121.0.6167.85/chrome-linux64/chrome',
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
