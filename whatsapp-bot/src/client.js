import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

const { Client, LocalAuth } = pkg

export function createWhatsAppClient() {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: '248-snooker' }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
