import { test, expect } from '@playwright/test'

test.describe('Venue Fix Pass 3 - Part 2 Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')
  })

  test('2.1 No blank frames during rapid pill switching', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']
    let blankFrameCount = 0
    let totalSwitches = 0

    console.log('=== 2.1 BLANK FRAME TEST (30 rapid switches) ===')

    for (let i = 0; i < 30; i++) {
      const randomPill = pills[Math.floor(Math.random() * pills.length)]
      await page.locator(`button:has-text("${randomPill}")`).first().click()

      // Wait 50ms (human click speed)
      await page.waitForTimeout(50)

      // Check if stage has visible images
      const hasVisibleImage = await page.evaluate(() => {
        const stage = document.querySelector('[id^="panel-"]')
        if (!stage) return false

        const imgs = stage.querySelectorAll('img')
        return Array.from(imgs).some(img => {
          const el = img as HTMLImageElement
          const style = window.getComputedStyle(el)
          const opacity = parseFloat(style.opacity)
          return opacity > 0.5 && el.complete && el.naturalWidth > 0
        })
      })

      if (!hasVisibleImage) {
        blankFrameCount++
      }

      totalSwitches++
    }

    console.log(`Total switches: ${totalSwitches}`)
    console.log(`Blank frames: ${blankFrameCount}`)
    console.log(`Blank rate: ${((blankFrameCount / totalSwitches) * 100).toFixed(1)}%`)

    // Target: <5% blank rate (crossfade should prevent most blanks)
    expect(blankFrameCount / totalSwitches).toBeLessThan(0.05)
  })

  test('2.2 Images fill stage completely (no letterboxing)', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']

    console.log('=== 2.2 IMAGE FIT TEST ===')

    for (const pillText of pills) {
      await page.locator(`button:has-text("${pillText}")`).first().click()
      await page.waitForTimeout(800)

      const fitData = await page.evaluate(() => {
        const stage = document.querySelector('[id^="panel-"]')
        if (!stage) return null

        const stageRect = stage.getBoundingClientRect()
        const imgs = Array.from(stage.querySelectorAll('img')).filter(img => {
          const rect = img.getBoundingClientRect()
          return rect.width > 100 && rect.height > 100
        })

        return imgs.map(img => {
          const el = img as HTMLImageElement
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)

          return {
            alt: el.alt,
            objectFit: style.objectFit,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
            stageWidth: stageRect.width,
            stageHeight: stageRect.height,
            fillsWidth: Math.abs(rect.width - stageRect.width) < 2,
            fillsHeight: Math.abs(rect.height - stageRect.height) < 2,
          }
        })
      })

      if (!fitData) continue

      fitData.forEach((data, idx) => {
        console.log(`\nPill: ${pillText}, Image ${idx + 1}:`)
        console.log(`  object-fit: ${data.objectFit}`)
        console.log(`  Stage: ${data.stageWidth.toFixed(0)}×${data.stageHeight.toFixed(0)}`)
        console.log(`  Rendered: ${data.renderedWidth.toFixed(0)}×${data.renderedHeight.toFixed(0)}`)
        console.log(`  Fills width: ${data.fillsWidth ? '✓' : '✗'}`)
        console.log(`  Fills height: ${data.fillsHeight ? '✓' : '✗'}`)

        // Technology pill uses contain, others use cover
        if (pillText === '科技體驗') {
          expect(data.objectFit).toBe('contain')
        } else {
          expect(data.objectFit).toBe('cover')
          // Cover images should fill at least one dimension
          expect(data.fillsWidth || data.fillsHeight).toBe(true)
        }
      })
    }
  })

  test('2.3 Room Viewer fits iPad landscape viewport', async ({ page }) => {
    // iPad Safari landscape: 1180×820 browser, minus ~130px chrome = ~690px viewport
    await page.setViewportSize({ width: 1180, height: 820 })
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const measurements = await page.evaluate(() => {
      const navbar = document.querySelector('nav')
      const section = document.querySelector('section:has(h2)')
      const heading = section?.querySelector('h2')
      const stage = section?.querySelector('[id^="panel-"]')

      const navbarRect = navbar?.getBoundingClientRect()
      const headingRect = heading?.getBoundingClientRect()
      const stageRect = stage?.getBoundingClientRect()

      return {
        viewport: window.innerHeight,
        navbar: navbarRect?.height || 0,
        heading: headingRect?.height || 0,
        stage: stageRect?.height || 0,
        sectionTop: section?.getBoundingClientRect().top || 0,
        stageBottom: stageRect?.bottom || 0,
      }
    })

    console.log('=== 2.3 IPAD LANDSCAPE FIT ===')
    console.log(`Viewport: ${measurements.viewport}px`)
    console.log(`Navbar: ${measurements.navbar.toFixed(0)}px`)
    console.log(`Heading: ${measurements.heading.toFixed(0)}px`)
    console.log(`Stage: ${measurements.stage.toFixed(0)}px`)
    console.log(`Section top: ${measurements.sectionTop.toFixed(0)}px`)
    console.log(`Stage bottom: ${measurements.stageBottom.toFixed(0)}px`)

    const fitsInView = measurements.stageBottom <= measurements.viewport
    console.log(`\n${fitsInView ? '✓' : '✗'} Section ${fitsInView ? 'FITS' : 'OVERFLOWS'}`)

    if (!fitsInView) {
      const overflow = measurements.stageBottom - measurements.viewport
      console.log(`Overflow: ${overflow.toFixed(0)}px`)
    }

    // Should fit with minimal or no overflow
    expect(measurements.stageBottom).toBeLessThanOrEqual(measurements.viewport + 50)
  })

  test('2.4 Why Us cards no orphan characters on iPad', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 })
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    // Scroll to Why Us section
    await page.locator('text=為什麼選擇').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const orphanCheck = await page.evaluate(() => {
      // Find all Why Us cards
      const cards = Array.from(document.querySelectorAll('section p')).filter(p => {
        const text = p.textContent || ''
        return text.includes('網上預訂') || text.includes('全面禁煙') || text.includes('零打擾')
      })

      return cards.map(card => {
        const text = card.textContent || ''
        const spans = Array.from(card.querySelectorAll('span'))

        // Check if text is split by comma
        const hasComma = text.includes('，')

        // Check line count
        const rect = card.getBoundingClientRect()
        const lineHeight = parseFloat(window.getComputedStyle(card).lineHeight)
        const estimatedLines = Math.round(rect.height / lineHeight)

        // Check for orphans: single character on last line
        const lastSpan = spans[spans.length - 1]
        const lastSpanText = lastSpan?.textContent || ''
        const isOrphan = lastSpanText.length <= 2 && estimatedLines > 1

        return {
          text: text.substring(0, 50),
          hasComma,
          lines: estimatedLines,
          isOrphan,
          spans: spans.length,
          lastSpanText,
        }
      })
    })

    console.log('=== 2.4 ORPHAN CHARACTER CHECK (iPad 1180×820) ===')

    orphanCheck.forEach((card, idx) => {
      console.log(`\nCard ${idx + 1}: "${card.text}..."`)
      console.log(`  Has comma: ${card.hasComma}`)
      console.log(`  Estimated lines: ${card.lines}`)
      console.log(`  Spans: ${card.spans}`)
      console.log(`  Last span text: "${card.lastSpanText}"`)
      console.log(`  ${card.isOrphan ? '✗ ORPHAN DETECTED' : '✓ No orphan'}`)

      // No card should have orphan characters
      expect(card.isOrphan).toBe(false)
    })
  })

  test('2.5 Slider thumb accessible and functional', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Click "場地裝修" to ensure slider is visible
    await page.locator('button:has-text("場地裝修")').first().click()
    await page.waitForTimeout(500)

    // Find slider thumb
    const thumb = page.locator('[role="slider"]').first()
    await expect(thumb).toBeVisible()

    // Check ARIA attributes
    const ariaMin = await thumb.getAttribute('aria-valuemin')
    const ariaMax = await thumb.getAttribute('aria-valuemax')
    const ariaLabel = await thumb.getAttribute('aria-label')

    console.log('=== 2.5 SLIDER ACCESSIBILITY ===')
    console.log(`aria-valuemin: ${ariaMin}`)
    console.log(`aria-valuemax: ${ariaMax}`)
    console.log(`aria-label: ${ariaLabel}`)

    expect(ariaMin).toBe('0')
    expect(ariaMax).toBe('100')
    expect(ariaLabel).toBeTruthy()

    // Test keyboard navigation
    await thumb.focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(100)

    const valueAfterRight = await thumb.getAttribute('aria-valuenow')
    console.log(`After ArrowRight: ${valueAfterRight}`)

    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(100)

    const valueAfterLeft = await thumb.getAttribute('aria-valuenow')
    console.log(`After ArrowLeft: ${valueAfterLeft}`)

    // Values should change
    expect(valueAfterRight).not.toBe(valueAfterLeft)

    // Test Home/End keys
    await page.keyboard.press('End')
    await page.waitForTimeout(100)
    const valueAtEnd = await thumb.getAttribute('aria-valuenow')
    console.log(`After End: ${valueAtEnd}`)
    expect(valueAtEnd).toBe('100')

    await page.keyboard.press('Home')
    await page.waitForTimeout(100)
    const valueAtHome = await thumb.getAttribute('aria-valuenow')
    console.log(`After Home: ${valueAtHome}`)
    expect(valueAtHome).toBe('0')
  })

  test('2.6 Crossfade transition smooth and complete', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Switch pills and measure transition
    await page.locator('button:has-text("場地裝修")').first().click()
    await page.waitForTimeout(800)

    console.log('=== 2.6 CROSSFADE TRANSITION ===')

    // Record opacity during transition
    await page.locator('button:has-text("舒適自在")').first().click()

    const opacityLog: number[] = []
    const startTime = Date.now()

    // Sample opacity every 50ms for 500ms
    while (Date.now() - startTime < 500) {
      const opacity = await page.evaluate(() => {
        const stage = document.querySelector('[id^="panel-"]')
        const layers = stage?.querySelectorAll(':scope > div')
        if (!layers || layers.length < 2) return [1]

        return Array.from(layers).map(layer => {
          return parseFloat(window.getComputedStyle(layer as HTMLElement).opacity)
        })
      })

      if (Array.isArray(opacity)) {
        opacityLog.push(Math.max(...opacity))
      }

      await page.waitForTimeout(50)
    }

    console.log('Opacity samples:', opacityLog.map(o => o.toFixed(2)).join(', '))

    // At least one sample should show crossfade (opacity between 0.3 and 0.7)
    const hasCrossfade = opacityLog.some(o => o > 0.3 && o < 0.7)
    console.log(`Crossfade detected: ${hasCrossfade ? '✓' : '✗'}`)

    // Final opacity should be 1 (fully visible)
    await page.waitForTimeout(500)
    const finalOpacity = await page.evaluate(() => {
      const stage = document.querySelector('[id^="panel-"]')
      const frontLayer = stage?.querySelector(':scope > div:first-child')
      return frontLayer ? parseFloat(window.getComputedStyle(frontLayer as HTMLElement).opacity) : 0
    })

    console.log(`Final opacity: ${finalOpacity}`)
    expect(finalOpacity).toBeGreaterThan(0.95)
  })

  test('2.7 Image preloading on hover/focus', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Hover over "舒適自在" pill (not active)
    const comfortPill = page.locator('button:has-text("舒適自在")').first()
    await comfortPill.hover()

    console.log('=== 2.7 PRELOAD ON HOVER ===')
    console.log('Hovered over 舒適自在 pill, waiting 500ms...')

    await page.waitForTimeout(500)

    // Check network activity for image requests
    const imageRequests = await page.evaluate(() => {
      return performance
        .getEntriesByType('resource')
        .filter(entry => {
          const resource = entry as PerformanceResourceTiming
          return resource.name.includes('.webp') || resource.name.includes('.jpg')
        })
        .map(entry => {
          const resource = entry as PerformanceResourceTiming
          return {
            name: resource.name.split('/').pop(),
            duration: resource.duration.toFixed(0),
          }
        })
    })

    console.log('Image requests:', imageRequests)

    // Should have preloaded comfort images
    const hasComfortImages = imageRequests.some(
      req => req.name?.includes('lounge') || req.name?.includes('stools')
    )

    console.log(`Comfort images preloaded: ${hasComfortImages ? '✓' : '✗'}`)
    expect(hasComfortImages).toBe(true)
  })

  test('2.8 URL param ?room=eternity works', async ({ page }) => {
    await page.goto('http://localhost:3000/zh-HK/venue?room=eternity')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const dividerPosition = await page.evaluate(() => {
      const thumb = document.querySelector('[role="slider"]') as HTMLElement
      if (!thumb) return null

      const left = thumb.style.left || thumb.getAttribute('style')?.match(/left:\s*([\d.]+)%/)?.[1]
      return left ? parseFloat(left) : null
    })

    console.log('=== 2.8 URL PARAM TEST ===')
    console.log(`?room=eternity → divider at ${dividerPosition}%`)

    // Should be at 0% (full Eternity view)
    expect(dividerPosition).toBeLessThan(5)
  })

  test('2.9 Mobile layout renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    console.log('=== 2.9 MOBILE LAYOUT (390×844) ===')

    // Check if pills are in horizontal scroll container
    const pillsLayout = await page.evaluate(() => {
      const container = document.querySelector('div[style*="overflow-x"]')
      const pills = Array.from(document.querySelectorAll('[role="tab"]'))

      return {
        hasScrollContainer: !!container,
        pillCount: pills.length,
        firstPillWidth: (pills[0] as HTMLElement)?.getBoundingClientRect().width || 0,
      }
    })

    console.log(`Has scroll container: ${pillsLayout.hasScrollContainer ? '✓' : '✗'}`)
    console.log(`Pill count: ${pillsLayout.pillCount}`)
    console.log(`First pill width: ${pillsLayout.firstPillWidth.toFixed(0)}px`)

    expect(pillsLayout.hasScrollContainer).toBe(true)
    expect(pillsLayout.pillCount).toBe(4)
  })
})
