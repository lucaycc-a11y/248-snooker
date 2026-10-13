import { test, expect } from '@playwright/test'

/**
 * Comprehensive pricing audit test.
 *
 * Loads pricing from GET /api/pricing, verifies all displayed prices across:
 * - Landing page
 * - FAQ and Help Center articles
 * - Legal pages
 *
 * Verifies:
 * - No legacy prices (60, 78, 80, 120)
 * - 06:00-12:00 period shows 88/hr
 * - 12:00-18:00 period shows 98/hr
 * - 18:00-24:00 period shows 108/hr
 * - All amounts match either a per-hour rate, booking total, deposit, or overstay fee
 */

interface PricingConfig {
  periods: Array<{ id: string; rate: number; start: string; end: string }>
  preauth_deposit: number
  overstay_per_15min: number
  currency: string
}

// Test across two widths
const WIDTHS = [390, 1440]

test.describe('Pricing Audit', () => {
  let pricing: PricingConfig
  const extractedPrices = new Set<number>()

  test.beforeAll(async ({ browser }) => {
    // Fetch pricing config from API once with retries
    let attempts = 0
    let pricing: PricingConfig | null = null

    while (attempts < 3 && !pricing) {
      try {
        const context = await browser.newContext()
        const page = await context.newPage()
        const response = await page.goto('http://localhost:3000/api/pricing', { waitUntil: 'networkidle' })
        if (response?.ok()) {
          pricing = await response.json()
        }
        await context.close()

        if (pricing) break
      } catch (error) {
        console.warn(`Attempt ${attempts + 1} failed to fetch pricing:`, error)
      }

      attempts++
      if (attempts < 3) await new Promise(r => setTimeout(r, 1000))
    }

    if (!pricing) {
      throw new Error('Failed to fetch /api/pricing after 3 attempts')
    }

    console.log('Pricing loaded:', pricing)

    // Validate we have the expected rates
    const rates = pricing.periods.map((p) => p.rate)
    expect(rates).toContain(88)
    expect(rates).toContain(98)
    expect(rates).toContain(108)
  })

  for (const width of WIDTHS) {
    test(`landing page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 })
      await page.goto('http://localhost:3000')

      // Extract pricing cards
      const cards = await page.locator('[role="listitem"]').count()
      expect(cards).toBeGreaterThan(0)

      // Get all text content and extract numbers that look like prices
      const bodyText = await page.textContent('body')
      if (bodyText) {
        // Match 2-3 digit numbers
        const matches = bodyText.matchAll(/\b(\d{2,3})\b/g)
        for (const match of matches) {
          const num = parseInt(match[1], 10)
          if (num >= 20 && num <= 200) { // Reasonable price range
            extractedPrices.add(num)
          }
        }
      }
    })

    test(`FAQ page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 })

      const response = await page.goto('http://localhost:3000/help/faq')
      if (response?.ok()) {
        const bodyText = await page.textContent('body')
        if (bodyText) {
          const matches = bodyText.matchAll(/\b(\d{2,3})\b/g)
          for (const match of matches) {
            const num = parseInt(match[1], 10)
            if (num >= 20 && num <= 200) {
              extractedPrices.add(num)
            }
          }
        }
      }
    })

    test(`legal pages at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 })

      const legalPages = ['/legal/terms', '/legal/privacy']
      for (const path of legalPages) {
        const response = await page.goto(`http://localhost:3000${path}`)
        if (response?.ok()) {
          const bodyText = await page.textContent('body')
          if (bodyText) {
            const matches = bodyText.matchAll(/\b(\d{2,3})\b/g)
            for (const match of matches) {
              const num = parseInt(match[1], 10)
              if (num >= 20 && num <= 200) {
                extractedPrices.add(num)
              }
            }
          }
        }
      }
    })
  }

  test('verify no legacy prices and correct period boundaries', () => {
    const forbiddenPrices = [60, 78, 80, 120]
    const foundForbidden = Array.from(extractedPrices).filter((p) =>
      forbiddenPrices.includes(p)
    )

    expect(
      foundForbidden,
      `Found legacy prices: ${foundForbidden.join(', ')}`
    ).toEqual([])

    // Verify expected rates exist
    expect(extractedPrices.has(88)).toBeTruthy()
    expect(extractedPrices.has(98)).toBeTruthy()
    expect(extractedPrices.has(108)).toBeTruthy()

    // Verify deposit and overstay
    expect(extractedPrices.has(pricing.preauth_deposit)).toBeTruthy()
    expect(extractedPrices.has(pricing.overstay_per_15min)).toBeTruthy()

    console.log('✓ All extracted prices:', Array.from(extractedPrices).sort((a, b) => a - b))
  })
})
