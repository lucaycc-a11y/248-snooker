#!/usr/bin/env node
// Validates that app/member/member-ui.css has 0 global selectors and is 100% scoped under .m8.*
// Exit code 0 = pass, 1 = fail. Run: node scripts/check-member-css-scope.mjs
import fs from 'node:fs'
import postcss from 'postcss'

const CSS = 'app/member/member-ui.css'
const css = fs.readFileSync(CSS, 'utf8')
const root = postcss.parse(css)

const BANNED = [':root', 'html', 'body', '*']
const issues = []

root.walkRules((rule) => {
  const p = rule.parent
  if (p && p.type === 'atrule' && /keyframes$/.test(p.name)) return // keyframes are OK (prefixed at generation)
  for (const sel of rule.selectors) {
    const norm = sel.trim().split(/\s+/)[0]
    if (BANNED.includes(norm)) issues.push({ sel, source: rule.toString().slice(0, 60) })
    if (!norm.startsWith('.m8')) issues.push({ sel, source: rule.toString().slice(0, 60) })
  }
})

if (issues.length === 0) {
  console.log(`✅ ${CSS}: 0 global selectors, 100% scoped`)
  process.exit(0)
}

console.log(`❌ ${CSS}: ${issues.length} unscoped selectors found:\n`)
issues.slice(0, 10).forEach(({ sel, source }) => console.log(`  ${sel}\n    ${source}...`))
if (issues.length > 10) console.log(`  ... and ${issues.length - 10} more`)
process.exit(1)
