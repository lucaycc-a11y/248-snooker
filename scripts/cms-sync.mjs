import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const APP_DIR = join(ROOT, 'app')
const COMPONENTS_DIR = join(ROOT, 'components')
const MESSAGES_DIR = join(ROOT, 'messages')
const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|jsx?|mdx?)$/.test(entry.name)) files.push(full)
  }
  return files
}

function extractKeys(source) {
  const keys = new Set()
  const patterns = [
    /data-cms-key\s*=\s*["'`]([^"'`]+)["'`]/g,
    /cmsKey\s*=\s*["'`]([^"'`]+)["'`]/g,
  ]
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) keys.add(match[1])
  }
  return [...keys]
}

function flatten(value, prefix = '') {
  if (typeof value === 'string') return [prefix]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => {
    const next = prefix ? `${prefix}.${key}` : key
    return flatten(nested, next)
  })
}

const files = [...walk(APP_DIR), ...walk(COMPONENTS_DIR)]
const extracted = new Set()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const key of extractKeys(text)) extracted.add(key)
}

const report = {
  keys: [...extracted].sort(),
  missingByLocale: {},
  orphanedByLocale: {},
}

for (const locale of LOCALES) {
  const data = JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8'))
  const existing = new Set(flatten(data))
  report.missingByLocale[locale] = [...extracted].filter((key) => !existing.has(key)).sort()
  report.orphanedByLocale[locale] = [...existing].filter((key) => !extracted.has(key)).sort()
}

writeFileSync(join(ROOT, 'cms-sync-report.json'), JSON.stringify(report, null, 2))

if (existsSync(join(ROOT, 'supabase', 'migrations', '0001_pages_foundation.sql'))) {
  writeFileSync(
    join(ROOT, 'cms-sync-migration-snapshot.sql'),
    readFileSync(join(ROOT, 'supabase', 'migrations', '0001_pages_foundation.sql'), 'utf8')
  )
}

console.log(`CMS keys found: ${report.keys.length}`)
for (const locale of LOCALES) {
  console.log(`${locale}: missing ${report.missingByLocale[locale].length}, orphaned ${report.orphanedByLocale[locale].length}`)
}
