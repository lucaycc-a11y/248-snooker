#!/usr/bin/env node
/**
 * Merge i18n fragments into main locale files
 *
 * Sub-agents write ONLY fragments (messages/fragments/<area>.<locale>.json).
 * This script merges them into messages/<locale>.json for all 4 locales.
 *
 * Usage: node scripts/merge-i18n-fragments.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const messagesDir = path.join(rootDir, 'messages')
const fragmentsDir = path.join(messagesDir, 'fragments')

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function deepMerge(target, source) {
  const output = { ...target }
  for (const key in source) {
    if (typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
      output[key] = deepMerge(output[key] || {}, source[key])
    } else {
      output[key] = source[key]
    }
  }
  return output
}

function main() {
  // Ensure fragments directory exists
  if (!fs.existsSync(fragmentsDir)) {
    console.log('No fragments directory found. Skipping merge.')
    return
  }

  const fragmentFiles = fs.readdirSync(fragmentsDir).filter(f => f.endsWith('.json'))

  if (fragmentFiles.length === 0) {
    console.log('No fragment files found. Skipping merge.')
    return
  }

  console.log(`Found ${fragmentFiles.length} fragment files`)

  for (const locale of LOCALES) {
    const mainFile = path.join(messagesDir, `${locale}.json`)
    let mainMessages = loadJson(mainFile)

    // Find all fragments for this locale
    const localeFragments = fragmentFiles.filter(f => f.endsWith(`.${locale}.json`))

    if (localeFragments.length === 0) {
      console.log(`  ${locale}: no fragments`)
      continue
    }

    console.log(`  ${locale}: merging ${localeFragments.length} fragments`)

    for (const fragmentFile of localeFragments) {
      const fragmentPath = path.join(fragmentsDir, fragmentFile)
      const fragment = loadJson(fragmentPath)
      mainMessages = deepMerge(mainMessages, fragment)
    }

    saveJson(mainFile, mainMessages)
    console.log(`  ${locale}: saved ${Object.keys(mainMessages).length} keys`)
  }

  console.log('✓ i18n fragments merged')
}

main()
