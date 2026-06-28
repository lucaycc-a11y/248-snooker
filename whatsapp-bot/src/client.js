import { existsSync, readdirSync, statSync } from 'fs'
import { spawnSync } from 'child_process'
import pkg from 'whatsapp-web.js'
import qrcode from 'qrcode-terminal'

const { Client, LocalAuth } = pkg

const CHROME_INSTALL_DIR = '/opt/render/project/src/whatsapp-bot/.chrome'

// Recursively find a file by name under a directory
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
  const existing = findFile(CHROME_INSTALL_DIR, 'chrome')
  if (existing) {
    console.log('✅ Chrome already exists at:', existing)
    return existing
  }

  console.log('📥 Downloading Chrome to', CHROME_INSTALL_DIR, '...')
  spawnSync(
    'npx',
    ['puppeteer', 'browsers', 'install', 'chrome', '--path', CHROME_INSTALL_DIR],
    { stdio: 'inherit' }
  )

  const downloaded = findFile(CHROME_INSTALL_DIR, 'chrome')
  if (downloaded) {
    console.log('✅ Chrome downloaded to:', downloaded)
    return downloaded
  }

  console.warn('⚠️  Chrome download failed — puppeteer will use its own detection')
  return undefined
}

export function createWhatsAppClient() {
  const chromePath = ensureChrome()

  const client = new Client({
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

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp disconnected:', reason)
  })

  return client
}
