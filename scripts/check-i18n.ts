/**
 * Check i18n consistency: all t('key') calls must have keys in all locale files.
 * Locale files must have identical key sets.
 *
 * Run with: npx ts-node scripts/check-i18n.ts
 * Or add to package.json: "check-i18n": "ts-node scripts/check-i18n.ts"
 */

import fs from 'fs'
import path from 'path'

const LOCALE_DIR = path.join(process.cwd(), 'messages')
const APP_DIR = path.join(process.cwd(), 'app')
const COMPONENTS_DIR = path.join(process.cwd(), 'components')
const LIB_DIR = path.join(process.cwd(), 'lib')

const LOCALES = ['zh-HK', 'en', 'zh-CN']
const LOCALE_FILES = LOCALES.map(l => path.join(LOCALE_DIR, `${l}.json`))

let errorCount = 0
let warnCount = 0

function error(msg: string) {
  console.error(`❌ ${msg}`)
  errorCount++
}

function warn(msg: string) {
  console.warn(`⚠️ ${msg}`)
  warnCount++
}

function info(msg: string) {
  console.log(`✓ ${msg}`)
}

// Load all locale files
const localeData: Record<string, any> = {}
for (const locale of LOCALES) {
  const file = path.join(LOCALE_DIR, `${locale}.json`)
  try {
    localeData[locale] = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    error(`Failed to parse ${locale}.json: ${(e as Error).message}`)
  }
}

// Flatten locale keys (e.g., { wallet: { title: ... } } → ["wallet.title"])
function flattenKeys(obj: any, prefix = ''): Set<string> {
  const keys = new Set<string>()
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, fullKey).forEach(key => keys.add(key))
    } else {
      keys.add(fullKey)
    }
  }
  return keys
}

// Check locale consistency
info('Checking locale file consistency...')
const allKeysByLocale: Record<string, Set<string>> = {}
for (const locale of LOCALES) {
  allKeysByLocale[locale] = flattenKeys(localeData[locale])
}

const keySets = Object.values(allKeysByLocale)
const firstSet = keySets[0]
for (let i = 1; i < keySets.length; i++) {
  const missing = new Set([...firstSet].filter(k => !keySets[i].has(k)))
  const extra = new Set([...keySets[i]].filter(k => !firstSet.has(k)))
  if (missing.size > 0 || extra.size > 0) {
    error(
      `Locale files have different key sets:\n` +
      (missing.size > 0 ? `  Missing in ${LOCALES[i]}: ${Array.from(missing).slice(0, 5).join(', ')}${missing.size > 5 ? '...' : ''}\n` : '') +
      (extra.size > 0 ? `  Extra in ${LOCALES[i]}: ${Array.from(extra).slice(0, 5).join(', ')}${extra.size > 5 ? '...' : ''}` : '')
    )
  }
}

// Scan code for t() calls
info('Scanning code for t() calls...')
const usedKeys = new Set<string>()
const pattern = /t\(\s*['"`]([\w.]+)['"`]\s*\)/g

function scanDirectory(dir: string) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    if (file.startsWith('.') || file === 'node_modules' || file === '.next') continue
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      scanDirectory(fullPath)
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      let match
      while ((match = pattern.exec(content)) !== null) {
        usedKeys.add(match[1])
      }
    }
  }
}

scanDirectory(APP_DIR)
scanDirectory(COMPONENTS_DIR)
scanDirectory(LIB_DIR)

// Check if all used keys exist in all locales
info(`Found ${usedKeys.size} unique translation keys in code`)
const availableKeys = allKeysByLocale[LOCALES[0]]
const missingKeys: string[] = []

for (const key of usedKeys) {
  // Skip non-key patterns (e.g., "Space8", "-", "/")
  if (key.length < 3 || /^[\/\-\.]/.test(key) || key === 'Space8') {
    continue
  }
  if (!availableKeys.has(key)) {
    missingKeys.push(key)
  }
}

if (missingKeys.length > 0) {
  error(`Found ${missingKeys.length} missing keys in locale files:`)
  missingKeys.slice(0, 20).forEach(k => console.error(`  - ${k}`))
  if (missingKeys.length > 20) {
    console.error(`  ... and ${missingKeys.length - 20} more`)
  }
}

// Check for unused keys (warn only)
const unusedKeys: string[] = []
for (const key of availableKeys) {
  // Skip common structural keys
  if (key.includes('errors.') || key.includes('placeholder')) {
    continue
  }
  if (!usedKeys.has(key)) {
    unusedKeys.push(key)
  }
}

if (unusedKeys.length > 0) {
  warn(`Found ${unusedKeys.length} potentially unused keys in locale files (this is a warning, not an error)`)
}

// Report
console.log('\n' + '='.repeat(60))
if (errorCount === 0) {
  console.log('✅ i18n check passed!')
  console.log(`   - All ${usedKeys.size} used keys exist in all locale files`)
  console.log(`   - Locale files are consistent`)
  process.exit(0)
} else {
  console.log(`❌ i18n check failed with ${errorCount} error(s) and ${warnCount} warning(s)`)
  process.exit(1)
}
