const { chromium } = require('playwright')
const axe = require('@axe-core/playwright').default
const path = require('path')
const fs = require('fs')

const PAGES = [
  { url: '/en', label: 'home' },
  { url: '/en/venue', label: 'venue' },
  { url: '/en/about', label: 'about' },
  { url: '/en/credits', label: 'credits' },
  { url: '/en/book', label: 'book' },
]

const BASE = 'http://localhost:3000'
const ALL_VIOLATIONS = {}

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
  })

  for (const { url, label } of PAGES) {
    const page = await context.newPage()
    try {
      console.log(`\n🔍 Scanning: ${label} (${BASE}${url})`)
      await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle', timeout: 30000 })
      // Wait a bit for any animations
      await page.waitForTimeout(3000)

      // Run axe-core with full analysis
      const results = await new axe(page).analyze({
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
      })

      const violations = results.violations
      const passes = results.passes

      console.log(`  Violations: ${violations.length}, Passes: ${passes.length}`)

      // Categorize by impact
      const critical = violations.filter(v => v.impact === 'critical')
      const serious = violations.filter(v => v.impact === 'serious')
      const moderate = violations.filter(v => v.impact === 'moderate')
      const minor = violations.filter(v => v.impact === 'minor')

      console.log(`  Critical: ${critical.length}, Serious: ${serious.length}, Moderate: ${moderate.length}, Minor: ${minor.length}`)

      if (violations.length > 0) {
        ALL_VIOLATIONS[label] = { violations, url: `${BASE}${url}` }

        for (const v of violations) {
          console.log(`\n  [${v.impact.toUpperCase()}] ${v.id}: ${v.help}`)
          console.log(`    ${v.helpUrl}`)
          for (const n of v.nodes) {
            const target = n.target?.join(', ') || '?'
            const snippet = (n.html || '').slice(0, 120)
            console.log(`    → ${target}`)
            console.log(`      \`${snippet}\``)
            if (n.failureSummary) {
              const summary = n.failureSummary.split('\n')[0].slice(0, 150)
              console.log(`      ⚠ ${summary}`)
            }
          }
        }
      }
    } catch (err) {
      console.error(`  ❌ Error scanning ${label}: ${err.message}`)
    } finally {
      await page.close()
    }
  }

  await browser.close()

  // Summary
  console.log('\n\n═══════════════════════════════════════════')
  console.log('  ACCESSIBILITY AUDIT SUMMARY')
  console.log('═══════════════════════════════════════════')

  let totalCritical = 0, totalSerious = 0, totalModerate = 0, totalMinor = 0
  for (const [label, data] of Object.entries(ALL_VIOLATIONS)) {
    const c = data.violations.filter(v => v.impact === 'critical').length
    const s = data.violations.filter(v => v.impact === 'serious').length
    const m = data.violations.filter(v => v.impact === 'moderate').length
    const mi = data.violations.filter(v => v.impact === 'minor').length
    totalCritical += c; totalSerious += s; totalModerate += m; totalMinor += mi
    console.log(`\n  ${label}:`)
    console.log(`    Critical: ${c} | Serious: ${s} | Moderate: ${m} | Minor: ${mi}`)
  }

  console.log(`\n  TOTAL: Critical: ${totalCritical} | Serious: ${totalSerious} | Moderate: ${totalModerate} | Minor: ${totalMinor}`)

  // Save full report
  const reportPath = path.join(__dirname, '..', 'axe-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(ALL_VIOLATIONS, null, 2))
  console.log(`\n  Full report saved to: ${reportPath}`)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})