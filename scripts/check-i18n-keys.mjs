#!/usr/bin/env node
/**
 * Check i18n Keys - Verify all t() calls exist in all locales
 *
 * Every t('key') or t("key") in TSX must exist in all 4 locale files.
 * Otherwise build and CI fail.
 *
 * Also enforces: no fallback pattern like t('key') || 'fallback text'
 * (that would be caught by the lint rule, but this script double-checks).
 *
 * Usage: node scripts/check-i18n-keys.mjs
 * Exit 0 if all OK, exit 1 with error list if violations found.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function getAllKeys(obj, prefix = '') {
  const keys = new Set()
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      getAllKeys(value, fullKey).forEach(k => keys.add(k))
    } else {
      keys.add(fullKey)
    }
  }
  return keys
}

function extractTranslationKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const keys = new Set()

  // Match t('key') and t("key")
  const tCallRegex = /\bt\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let match

  while ((match = tCallRegex.exec(content)) !== null) {
    keys.add(match[1])
  }

  return keys
}

function checkFallbackPattern(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const violations = []

  // Match t(...) || '...' or t(...) || "..."
  const fallbackRegex = /\bt\s*\([^)]+\)\s*\|\|\s*['"][^'"]*['"]/g
  let match

  while ((match = fallbackRegex.exec(content)) !== null) {
    violations.push({ file: filePath, pattern: match[0] })
  }

  return violations
}

async function main() {
  const messagesDir = path.join(rootDir, 'messages')

  // Load all locale files
  const localeData = {}
  const localeKeys = {}

  for (const locale of LOCALES) {
    const localeFile = path.join(messagesDir, `${locale}.json`)
    localeData[locale] = loadJson(localeFile)
    localeKeys[locale] = getAllKeys(localeData[locale])
    console.log(`Loaded ${localeKeys[locale].size} keys from ${locale}.json`)
  }

  // Find all TSX files
  const tsxFiles = await glob('app/**/*.tsx', { cwd: rootDir })
  const componentFiles = await glob('components/**/*.tsx', { cwd: rootDir })
  const allFiles = [...tsxFiles, ...componentFiles]

  console.log(`Checking ${allFiles.length} TSX files...\n`)

  const missingKeys = []
  const fallbackViolations = []

  for (const file of allFiles) {
    const filePath = path.join(rootDir, file)

    // Check for fallback patterns
    const fallbacks = checkFallbackPattern(filePath)
    fallbackViolations.push(...fallbacks)

    // Extract t() calls
    const usedKeys = extractTranslationKeys(filePath)

    for (const key of usedKeys) {
      // Check if key exists in all locales
      for (const locale of LOCALES) {
        if (!localeKeys[locale].has(key)) {
          missingKeys.push({ file, key, locale })
        }
      }
    }
  }

  let hasErrors = false

  if (fallbackViolations.length > 0) {
    hasErrors = true
    console.error(`✗ Found ${fallbackViolations.length} forbidden fallback patterns:\n`)
    fallbackViolations.forEach(({ file, pattern }) => {
      console.error(`  ${file}:`)
      console.error(`    ${pattern}`)
    })
    console.error('\nRemove fallback patterns. All keys must exist in locale files.\n')
  }

  if (missingKeys.length > 0) {
    hasErrors = true
    console.error(`✗ Found ${missingKeys.length} missing translation keys:\n`)

    const byKey = {}
    missingKeys.forEach(({ file, key, locale }) => {
      if (!byKey[key]) byKey[key] = { files: new Set(), locales: new Set() }
      byKey[key].files.add(file)
      byKey[key].locales.add(locale)
    })

    Object.entries(byKey).forEach(([key, { files, locales }]) => {
      console.error(`  Key: "${key}"`)
      console.error(`    Missing in: ${[...locales].join(', ')}`)
      console.error(`    Used in: ${[...files].join(', ')}`)
    })

    console.error('\nAdd missing keys to all locale files or remove t() calls.\n')
  }

  if (hasErrors) {
    process.exit(1)
  }

  console.log('✓ All translation keys exist in all locales')
  console.log('✓ No forbidden fallback patterns found')
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
