/**
 * Pre-build check: ensure all locale message files have the same keys.
 * Run via `npm run check:i18n` or as part of the build pipeline.
 *
 * Exits with code 1 if any locale is missing keys that another locale has.
 */
const fs = require('fs')
const path = require('path')

const LOCALE_DIR = path.resolve(__dirname, '..', 'messages')
const LOCALE_FILES = ['en.json', 'zh-HK.json', 'zh-CN.json']
const SKIP_PATHS = ['legal', 'pricingPage', 'memberPage', 'venuePage', 'membershipPage', 'aboutPage']

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

// Load all locales
const locales = {}
for (const file of LOCALE_FILES) {
  const content = fs.readFileSync(path.join(LOCALE_DIR, file), 'utf-8')
  locales[file] = JSON.parse(content)
}

// Extract keys per locale (excluding arrays)
const keysByLocale = {}
for (const [file, data] of Object.entries(locales)) {
  keysByLocale[file] = collectKeys(stripArrays(data)).filter((k) => !shouldSkip(k))
}

// Compare
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

if (hasError) {
  console.error('\n⚠️  Locale keys are out of sync! Run `npm run check:i18n` to see details.')
  process.exit(1)
} else {
  console.log('✅ All locale files have matching keys.')
}