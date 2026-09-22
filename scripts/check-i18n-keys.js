/**
 * Pre-build check: ensure all locale message files have the same keys,
 * all namespaces used in code exist in locale files, and no duplicate keys exist.
 * Run via `npm run check:i18n` or as part of the build pipeline.
 *
 * Exits with code 1 if:
 * - any locale is missing keys that another locale has
 * - a namespace used in code is missing from any locale file
 * - any JSON object contains duplicate keys at the same level
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const LOCALE_DIR = path.resolve(__dirname, '..', 'messages')
const LOCALE_FILES = ['en.json', 'zh-HK.json', 'zh-CN.json']
const SKIP_PATHS = ['legal', 'pricingPage', 'memberPage', 'venuePage', 'membershipPage', 'aboutPage']
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks']

/**
 * Pre-existing key differences that are intentional (e.g. pricing hero text
 * only exists in en.json, comingSoon.err_rate_limited only in zh-HK/zh-CN).
 * These are not bugs — they're content decisions. Add to this set when you
 * intentionally add a key to one locale without adding it to the others.
 */
const INTENTIONAL_DIFFERENCES = new Set([
  'pricing.hero_eyebrow',
  'pricing.hero_line1',
  'pricing.hero_line2',
  'pricing.time_line1',
  'pricing.cta_line1',
  'pricing.cta_button',
  'pricing.faq_title',
  'pricing.faq_scroll_hint',
  'comingSoon.err_rate_limited',
])

/**
 * Recursively collect all leaf keys from a nested object.
 * Returns an array of dot-notation paths, e.g. ["auth.title", "auth.close", ...]
 */
function collectKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, p))
    } else {
      keys.push(p)
    }
  }
  return keys
}

/** Deep-clone an object, keeping only non-array leaf values. */
function stripArrays(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const result = {}
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        // Skip arrays — they're structured data, not translatable keys
        continue
      }
      result[k] = stripArrays(v)
    }
    return result
  }
  return obj
}

/** Check if a key path should be skipped (e.g. legal content is intentionally different per locale) */
function shouldSkip(keyPath) {
  return SKIP_PATHS.some((p) => keyPath.startsWith(p + '.') || keyPath === p)
}

/**
 * Extract all namespaces used in code via useTranslations('X') or getTranslations('X').
 * Returns a Set of namespace strings.
 */
function extractUsedNamespaces() {
  const namespaces = new Set()
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.resolve(__dirname, '..', dir)
    if (!fs.existsSync(dirPath)) continue

    try {
      // Find all TS/TSX/JS/JSX files
      const result = execSync(
        `find "${dirPath}" -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) 2>/dev/null || true`,
        { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      )
      const files = result.trim().split('\n').filter(Boolean)

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        // Match useTranslations('namespace') or getTranslations('namespace')
        const matches = content.matchAll(/(?:useTranslations|getTranslations)\(['"]([^'"]+)['"]\)/g)
        for (const match of matches) {
          namespaces.add(match[1])
        }
      }
    } catch (err) {
      // Silently skip if directory doesn't exist or command fails
    }
  }
  return namespaces
}

/**
 * Check for duplicate keys within the same JSON object (not across array elements).
 * Uses a custom JSON parser that tracks key uniqueness per object scope.
 */
function findDuplicateKeys(jsonText, filename) {
  const duplicates = []

  // Simple regex-based parser that respects JSON structure
  const lines = jsonText.split('\n')
  const objectStack = [] // Stack of { indent, keys: Set, path: string }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Skip empty lines and array markers
    if (!trimmed || trimmed === '[' || trimmed === ']' || trimmed === '],' || trimmed === '[,') {
      continue
    }

    // Detect object boundaries
    if (trimmed === '{' || trimmed === '{,') {
      const indent = line.search(/\S/)
      objectStack.push({ indent, keys: new Set(), path: '' })
      continue
    }

    if (trimmed === '}' || trimmed === '},') {
      if (objectStack.length > 0) objectStack.pop()
      continue
    }

    // Extract key from line like: "keyName": value
    const keyMatch = line.match(/^\s*"([^"]+)"\s*:/)
    if (keyMatch && objectStack.length > 0) {
      const key = keyMatch[1]
      const currentIndent = line.search(/\S/)

      // Pop scopes that are at same or deeper indent (we've left them)
      while (objectStack.length > 1 && objectStack[objectStack.length - 1].indent >= currentIndent) {
        objectStack.pop()
      }

      const currentScope = objectStack[objectStack.length - 1]

      // Check for duplicate
      if (currentScope.keys.has(key)) {
        duplicates.push({ line: i + 1, key })
      }
      currentScope.keys.add(key)

      // If this line opens a new object, push a new scope
      if (line.includes('{') && !trimmed.endsWith('},')) {
        const newIndent = line.search(/\S/)
        objectStack.push({ indent: newIndent + 2, keys: new Set(), path: key })
      }
    }
  }

  return duplicates
}

// Load all locales
const locales = {}
const localeTexts = {}
for (const file of LOCALE_FILES) {
  const filePath = path.join(LOCALE_DIR, file)
  const content = fs.readFileSync(filePath, 'utf-8')
  localeTexts[file] = content
  locales[file] = JSON.parse(content)
}

// Extract keys per locale (excluding arrays)
const keysByLocale = {}
for (const [file, data] of Object.entries(locales)) {
  keysByLocale[file] = collectKeys(stripArrays(data)).filter((k) => !shouldSkip(k))
}

// Compare keys across locales
const allKeySets = Object.values(keysByLocale)
const referenceSet = new Set(allKeySets[0]) // en.json as reference
for (const keys of allKeySets) {
  for (const k of keys) referenceSet.add(k)
}

let hasError = false
for (const [file, keys] of Object.entries(keysByLocale)) {
  const keySet = new Set(keys)
  for (const k of referenceSet) {
    if (INTENTIONAL_DIFFERENCES.has(k)) continue
    if (!keySet.has(k)) {
      console.error(`❌ ${file} is missing key: ${k}`)
      hasError = true
    }
  }
}

// Check for duplicate keys in each locale file
for (const [file, text] of Object.entries(localeTexts)) {
  const duplicates = findDuplicateKeys(text, file)
  if (duplicates.length > 0) {
    for (const dup of duplicates) {
      console.error(`❌ ${file} line ${dup.line}: duplicate key "${dup.key}" in the same object`)
      hasError = true
    }
  }
}

// Check that all namespaces used in code exist in all locale files
const usedNamespaces = extractUsedNamespaces()
for (const namespace of usedNamespaces) {
  for (const [file, data] of Object.entries(locales)) {
    // Support nested namespaces like 'member.offers' by traversing the path
    const parts = namespace.split('.')
    let current = data
    let found = true
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        found = false
        break
      }
    }
    if (!found) {
      console.error(`❌ ${file} is missing namespace used in code: "${namespace}"`)
      hasError = true
    }
  }
}

if (hasError) {
  console.error('\n⚠️  i18n validation failed! See errors above.')
  process.exit(1)
} else {
  console.log('✅ All locale files have matching keys.')
  console.log(`✅ All ${usedNamespaces.size} namespaces used in code are present.`)
  console.log('✅ No duplicate keys found.')
}
