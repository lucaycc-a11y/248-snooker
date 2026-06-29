import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const APP_DIR = join(ROOT, 'app')
const COMPONENTS_DIR = join(ROOT, 'components')

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (/\.(tsx?|jsx?|mdx?)$/.test(entry.name)) files.push(full)
  }
  return files
}

function hasHardcodedText(source) {
  const stripped = source.replace(/<CMSText[\s\S]*?<\/CMSText>/g, '')
  return />([^<{\n]*[A-Za-z]{3,}[^<{\n]*)</.test(stripped)
}

const files = [...walk(APP_DIR), ...walk(COMPONENTS_DIR)]
const offenders = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (hasHardcodedText(text)) offenders.push(file)
}

console.log(JSON.stringify({ filesScanned: files.length, offenders }, null, 2))
