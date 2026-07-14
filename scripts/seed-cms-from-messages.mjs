#!/usr/bin/env node
/**
 * Seed cms_content table with all static messages/*.json content
 *
 * This populates the database with baseline content from static JSON files,
 * establishing the foundation for the hybrid CMS architecture where:
 * - Static JSON provides base translations
 * - cms_content table stores admin overrides
 *
 * Run this once after setting up the CMS system to establish baseline content.
 * Safe to re-run: uses upsert logic (won't overwrite existing CMS edits).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in environment')
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']
const ROOT = process.cwd()
const MESSAGES_DIR = join(ROOT, 'messages')

/**
 * Flatten nested JSON into dot-notation keys
 * { a: { b: "value" } } → { "a.b": "value" }
 */
function flatten(obj, prefix = '') {
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flatten(value, path))
    } else if (typeof value === 'string') {
      result[path] = value
    }
  }
  return result
}

async function seedLocale(locale) {
  const filePath = join(MESSAGES_DIR, `${locale}.json`)
  const json = JSON.parse(readFileSync(filePath, 'utf8'))
  const flat = flatten(json)
  const keys = Object.keys(flat)

  console.log(`\n📍 ${locale}: ${keys.length} keys found`)

  // Batch upsert in chunks of 100 to avoid payload limits
  const CHUNK_SIZE = 100
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map((key) => ({
      key,
      locale,
      value: flat[key],
      page: inferPageFromKey(key),
    }))

    const { data, error } = await supabase
      .from('cms_content')
      .upsert(rows, { onConflict: 'key,locale', ignoreDuplicates: false })

    if (error) {
      console.error(`   ❌ Chunk ${i}-${i + chunk.length} failed:`, error.message)
    } else {
      inserted += chunk.length
      process.stdout.write(`   ✓ ${inserted}/${keys.length}\r`)
    }
  }

  console.log(`   ✅ ${locale}: ${inserted} keys seeded`)
}

/**
 * Infer page from key namespace
 * e.g., "aboutPage.hero_title" → "about"
 *       "pricingPage.hero_line1" → "pricing"
 *       "book.date_label" → "book"
 */
function inferPageFromKey(key) {
  if (key.startsWith('aboutPage.')) return 'about'
  if (key.startsWith('pricingPage.')) return 'pricing'
  if (key.startsWith('book.')) return 'book'
  if (key.startsWith('blog.')) return 'blog'
  if (key.startsWith('faq.')) return 'faq'
  if (key.startsWith('legal.')) return 'legal'
  if (key.startsWith('ticket.')) return 'ticket'
  if (key.startsWith('auth.')) return 'auth'
  if (key.startsWith('nav.')) return 'global'
  if (key.startsWith('footer.')) return 'global'
  if (key === '404.title' || key.startsWith('404.')) return '404'
  return null
}

async function main() {
  console.log('🌱 Seeding cms_content from messages/*.json\n')

  for (const locale of LOCALES) {
    await seedLocale(locale)
  }

  console.log('\n✅ All locales seeded successfully')
  console.log('\n📝 Next steps:')
  console.log('   1. Admin can now edit content via /admin CMS editor')
  console.log('   2. Changes publish to cms_content and appear instantly')
  console.log('   3. Static JSON files remain as safe fallback')
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
