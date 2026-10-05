import { test, expect } from '@playwright/test'

test.describe('Venue Room Viewer - no auto-scrolling', () => {
  test('should not scroll by itself for 15 seconds', async ({ page }) => {
    // Track all scroll events and history changes
    const scrollEvents: number[] = []
    const scrollToCalls: any[] = []
    const scrollIntoViewCalls: any[] = []
    const historyChanges: any[] = []

    await page.goto('/zh-HK/venue')

    // Inject monitoring code
    await page.evaluate(() => {
      // Track scrollY every frame
      const scrollYValues: number[] = []
      let rafId = 0

      function trackScroll() {
        scrollYValues.push(window.scrollY)
        rafId = requestAnimationFrame(trackScroll)
      }
      trackScroll()

      // Track scroll API calls
      const originalScrollTo = window.scrollTo
      const originalScrollBy = window.scrollBy
      const originalScroll = window.scroll
      const originalScrollIntoView = Element.prototype.scrollIntoView
      const originalReplaceState = history.replaceState
      const originalPushState = history.pushState

      ;(window as any).__scrollEvents = {
        scrollYValues,
        scrollToCalls: [] as any[],
        scrollByCalls: [] as any[],
        scrollCalls: [] as any[],
        scrollIntoViewCalls: [] as any[],
        replaceStateCalls: [] as any[],
        pushStateCalls: [] as any[],
      }

      window.scrollTo = function (...args) {
        ;(window as any).__scrollEvents.scrollToCalls.push({ args, stack: new Error().stack })
        return originalScrollTo.apply(this, args)
      }

      window.scrollBy = function (...args) {
        ;(window as any).__scrollEvents.scrollByCalls.push({ args, stack: new Error().stack })
        return originalScrollBy.apply(this, args)
      }

      window.scroll = function (...args) {
        ;(window as any).__scrollEvents.scrollCalls.push({ args, stack: new Error().stack })
        return originalScroll.apply(this, args)
      }

      Element.prototype.scrollIntoView = function (...args) {
        ;(window as any).__scrollEvents.scrollIntoViewCalls.push({
          element: this.tagName,
          args,
          stack: new Error().stack,
        })
        return originalScrollIntoView.apply(this, args)
      }

      history.replaceState = function (...args) {
        ;(window as any).__scrollEvents.replaceStateCalls.push({ args })
        return originalReplaceState.apply(this, args)
      }

      history.pushState = function (...args) {
        ;(window as any).__scrollEvents.pushStateCalls.push({ args })
        return originalPushState.apply(this, args)
      }

      // Clean up
      setTimeout(() => {
        cancelAnimationFrame(rafId)
      }, 16000)
    })

    // Wait for initial load
    await page.waitForLoadState('networkidle')

    // Record initial scrollY
    const initialScrollY = await page.evaluate(() => window.scrollY)

    // Wait 15 seconds with NO user input
    await page.waitForTimeout(15000)

    // Get final scrollY
    const finalScrollY = await page.evaluate(() => window.scrollY)

    // Get all tracked events
    const events = await page.evaluate(() => (window as any).__scrollEvents)

    // Report findings
    console.log('Initial scrollY:', initialScrollY)
    console.log('Final scrollY:', finalScrollY)
    console.log('scrollTo calls:', events.scrollToCalls.length)
    console.log('scrollBy calls:', events.scrollByCalls.length)
    console.log('scroll calls:', events.scrollCalls.length)
    console.log('scrollIntoView calls:', events.scrollIntoViewCalls.length)
    console.log('replaceState calls:', events.replaceStateCalls.length)
    console.log('pushState calls:', events.pushStateCalls.length)

    if (events.scrollToCalls.length > 0) {
      console.log('scrollTo stacks:', events.scrollToCalls.map((c: any) => c.stack))
    }
    if (events.scrollIntoViewCalls.length > 0) {
      console.log('scrollIntoView calls:', events.scrollIntoViewCalls)
    }
    if (events.replaceStateCalls.length > 0) {
      console.log('replaceState calls:', events.replaceStateCalls)
    }

    // Check scrollY didn't change
    expect(
      Math.abs(finalScrollY - initialScrollY),
      `scrollY changed from ${initialScrollY} to ${finalScrollY}`
    ).toBe(0)

    // Check no scroll API calls
    expect(events.scrollToCalls.length, 'window.scrollTo was called').toBe(0)
    expect(events.scrollByCalls.length, 'window.scrollBy was called').toBe(0)
    expect(events.scrollCalls.length, 'window.scroll was called').toBe(0)
    expect(events.scrollIntoViewCalls.length, 'scrollIntoView was called').toBe(0)

    // Check no history manipulation (which can trigger scroll restoration)
    expect(events.replaceStateCalls.length, 'history.replaceState was called').toBe(0)
    expect(events.pushStateCalls.length, 'history.pushState was called').toBe(0)
  })

  test('should have acceptable CLS', async ({ page }) => {
    await page.goto('/zh-HK/venue')

    // Track CLS
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) continue
            clsValue += (entry as any).value
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(clsValue)
        }, 5000)
      })
    })

    console.log('CLS:', cls)
    expect(cls).toBeLessThan(0.02)
  })
})
