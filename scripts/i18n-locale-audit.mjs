#!/usr/bin/env node
// Compares messages/{locale}.json key sets across all 4 routing locales
// (zh-HK/zh-CN/en/ja) and reports any key present in one locale but missing
// from another. Unlike scripts/cms-audit.mjs (which lints for hardcoded JSX
// text), this checks translation *completeness* across locales — that check
// didn't exist anywhere in the repo before this script.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function flatten(obj, prefix = '') {
  let keys = []
  for (const k of Object.keys(obj)) {
    const value = obj[k]
    const flatKey = prefix ? `${prefix}.${k}` : k
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys = keys.concat(flatten(value, flatKey))
    } else {
      keys.push(flatKey)
    }
  }
  return keys
}

const keysByLocale = {}
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const json = JSON.parse(readFileSync(filePath, 'utf8'))
  keysByLocale[locale] = new Set(flatten(json))
}

const allKeys = new Set(LOCALES.flatMap((l) => [...keysByLocale[l]]))

const missing = {}
for (const key of allKeys) {
  const missingIn = LOCALES.filter((l) => !keysByLocale[l].has(key))
  if (missingIn.length > 0) {
    missing[key] = missingIn
  }
}

const missingCount = Object.keys(missing).length
if (missingCount === 0) {
  console.log(`OK — all ${allKeys.size} keys present in all 4 locales (${LOCALES.join(', ')}).`)
  process.exit(0)
}

console.log(`Found ${missingCount} key(s) missing from at least one locale:\n`)
for (const [key, missingIn] of Object.entries(missing).sort()) {
  console.log(`  ${key}  →  missing in: ${missingIn.join(', ')}`)
}
process.exit(1)
