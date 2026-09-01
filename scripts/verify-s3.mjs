/**
 * verify-s3.mjs — Section 3「場地設施」layout verification
 *
 * Measures card dimensions, image/text ratio, scroll behavior, and responsive
 * recomposition across mobile and desktop breakpoints.
 *
 * Usage: node scripts/verify-s3.mjs
 * Requires: dev server on localhost:3100
 */
import { chromium, devices } from 'playwright'

const VIEWPORTS = [
  { label: 'mobile-375', opts: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  { label: 'mobile-390', opts: { ...devices['iPhone 12'] } },
  { label: 'tablet-768', opts: { viewport: { width: 768, height: 1024 } } },
  { label: 'laptop-1024', opts: { viewport: { width: 1024, height: 768 } } },
  { label: 'desktop-1440', opts: { viewport: { width: 1440, height: 900 } } },
]

const run = async () => {
  const browser = await chromium.launch()
  const results = {}

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext(vp.opts)
    const page = await ctx.newPage()
    await page.goto('http://localhost:3100/', { waitUntil: 'networkidle', timeout: 60000 })

    // Scroll to Section 3
    await page.evaluate(() => {
      const section = document.querySelector('[aria-labelledby="home-facilities-title"]')
      if (section) section.scrollIntoView({ behavior: 'instant' })
    })
    await page.waitForTimeout(500)

    const data = await page.evaluate(() => {
      const section = document.querySelector('[aria-labelledby="home-facilities-title"]')
      const track = section?.querySelector('[style*="touch-action"]') || section?.querySelector('.no-scrollbar')
      const cards = section?.querySelectorAll('[data-facility-card]')
      const dots = section?.querySelectorAll('button[aria-label]')
      const scrollContainer = track

      if (!section || !cards?.length) return { error: 'Section or cards not found' }

      const cardData = [...cards].map((card, i) => {
        const rect = card.getBoundingClientRect()
        const imgDiv = card.querySelector('.relative')
        const textDiv = card.querySelector('.flex.flex-\\[1\\]')
        const imgRect = imgDiv?.getBoundingClientRect()
        const textRect = textDiv?.getBoundingClientRect()
        return {
          index: i,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          imgHeight: imgRect ? Math.round(imgRect.height) : null,
          textHeight: textRect ? Math.round(textRect.height) : null,
          imgRatio: imgRect && rect.height ? Math.round((imgRect.height / rect.height) * 100) : null,
          textRatio: textRect && rect.height ? Math.round((textRect.height / rect.height) * 100) : null,
        }
      })

      // Check scroll container properties
      const cs = scrollContainer ? getComputedStyle(scrollContainer) : null
      const scrollProps = cs ? {
        overflowX: cs.overflowX,
        scrollSnapType: cs.scrollSnapType,
        display: cs.display,
        flexDirection: cs.flexDirection,
      } : null

      // Check card snap alignment
      const firstCard = cards[0]
      const cardCs = firstCard ? getComputedStyle(firstCard) : null
      const snapAlign = cardCs?.scrollSnapAlign || null

      // Check touch-action on scroll container
      const touchAction = scrollContainer?.style?.touchAction || null

      // Check if dots pagination is visible
      const dotsContainer = section?.querySelector('.flex.justify-center')
      const dotsVisible = dotsContainer ? getComputedStyle(dotsContainer).display !== 'none' : false

      // Check if track scrolls horizontally
      const trackScrollWidth = scrollContainer?.scrollWidth || 0
      const trackClientWidth = scrollContainer?.clientWidth || 0
      const canScrollHorizontally = trackScrollWidth > trackClientWidth

      // How many cards fully visible
      const sectionRect = section.getBoundingClientRect()
      const visibleCards = [...cards].filter(card => {
        const r = card.getBoundingClientRect()
        return r.left >= sectionRect.left - 10 && r.right <= sectionRect.right + 10
      }).length

      return {
        cardCount: cards.length,
        cards: cardData,
        scrollProps,
        snapAlign,
        touchAction,
        dotsVisible,
        canScrollHorizontally,
        trackScrollWidth,
        trackClientWidth,
        visibleCardsFullyVisible: visibleCards,
        firstCardVisible: cardData[0] ? `${cardData[0].width}×${cardData[0].height}` : null,
      }
    })

    results[vp.label] = data
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
}

run().catch((e) => { console.error('FAIL', e); process.exit(1) })
