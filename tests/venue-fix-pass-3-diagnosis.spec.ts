import { test, expect } from '@playwright/test'

test.describe('Venue Fix Pass 3 - Part 1 Diagnosis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')
  })

  test('1.1 Baked-in title text check', async ({ page }) => {
    // Scroll to Room Viewer section
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Find the stage container
    const stage = page.locator('[data-testid="room-stage"]').first()
    if (!(await stage.isVisible())) {
      console.log('Stage not found with testid, trying alternative selector')
      // Alternative: find by structure
    }

    // Hide all siblings of the image to isolate it
    await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[alt*="Space Infinity"], img[alt*="Space Eternity"]')
      imgs.forEach(img => {
        const parent = img.parentElement
        if (parent) {
          // Hide all siblings
          Array.from(parent.children).forEach(child => {
            if (child !== img) {
              ;(child as HTMLElement).style.display = 'none'
            }
          })
          // Remove any overlay text elements
          parent.querySelectorAll('h1, h2, h3, div[class*="title"], span[class*="title"]').forEach(el => {
            ;(el as HTMLElement).style.display = 'none'
          })
        }
      })
    })

    await page.waitForTimeout(500)

    // Take screenshot of isolated image
    await page.screenshot({
      path: 'tests/screenshots/venue-isolated-panorama.png',
      fullPage: false,
    })

    // Check if any overlay text elements exist in DOM
    const overlayText = await page.locator('text=/SPACE (INFINITY|ETERNITY)/i').count()

    console.log('=== 1.1 BAKED-IN TEXT DIAGNOSIS ===')
    console.log(`Overlay text elements found in DOM: ${overlayText}`)
    console.log('Screenshot saved: tests/screenshots/venue-isolated-panorama.png')
    console.log('Visual inspection required: Does the screenshot show "SPACE INFINITY/ETERNITY" text?')
    console.log('If YES → text is baked into JPG pixels (cannot remove without new source)')
    console.log('If NO → text is DOM/CSS overlay (can be removed)')
  })

  test('1.2 Stage image fit diagnosis', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']

    console.log('=== 1.2 STAGE IMAGE FIT DIAGNOSIS ===')

    for (const pillText of pills) {
      await page.locator(`button:has-text("${pillText}")`).first().click()
      await page.waitForTimeout(800)

      const images = await page.locator('img[alt*="Space"], img[alt*="設備"], img[alt*="iPad"]').all()

      for (let i = 0; i < Math.min(images.length, 2); i++) {
        const img = images[i]
        const isVisible = await img.isVisible()
        if (!isVisible) continue

        const imgData = await img.evaluate((el: HTMLImageElement) => {
          const rect = el.getBoundingClientRect()
          const parent = el.closest('[class*="stage"]') || el.parentElement
          const parentRect = parent?.getBoundingClientRect()

          return {
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            objectFit: window.getComputedStyle(el).objectFit,
            renderedWidth: rect.width,
            renderedHeight: rect.height,
            stageWidth: parentRect?.width || 0,
            stageHeight: parentRect?.height || 0,
            aspectRatio: el.naturalWidth / el.naturalHeight,
            alt: el.alt,
          }
        })

        console.log(`\nPill: ${pillText}, Image ${i + 1}:`)
        console.log(`  Natural: ${imgData.naturalWidth}×${imgData.naturalHeight} (${imgData.aspectRatio.toFixed(3)})`)
        console.log(`  Stage box: ${imgData.stageWidth.toFixed(0)}×${imgData.stageHeight.toFixed(0)}`)
        console.log(`  Rendered: ${imgData.renderedWidth.toFixed(0)}×${imgData.renderedHeight.toFixed(0)}`)
        console.log(`  object-fit: ${imgData.objectFit}`)
        console.log(`  Alt: ${imgData.alt}`)

        // Check if letterboxed
        const fillsWidth = Math.abs(imgData.renderedWidth - imgData.stageWidth) < 2
        const fillsHeight = Math.abs(imgData.renderedHeight - imgData.stageHeight) < 2

        if (!fillsWidth || !fillsHeight) {
          console.log(`  ⚠️  LETTERBOXED: Does not fill stage (width: ${fillsWidth}, height: ${fillsHeight})`)
        }
      }
    }
  })

  test('1.3 Blank stage reproduction', async ({ page }) => {
    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    // Throttle network to Slow 4G
    const client = await page.context().newCDPSession(page)
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps
      uploadThroughput: (3 * 1024 * 1024) / 8,
      latency: 400,
    })

    console.log('=== 1.3 BLANK STAGE DIAGNOSIS ===')
    console.log('Network throttled to Slow 4G')

    const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']
    let blankFrameCount = 0
    let totalSwitches = 0

    for (let i = 0; i < 30; i++) {
      const randomPill = pills[Math.floor(Math.random() * pills.length)]
      await page.locator(`button:has-text("${randomPill}")`).first().click()

      // Check stage immediately after click
      const stageState = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img[alt*="Space"], img[alt*="設備"], img[alt*="iPad"]'))
          .filter(img => {
            const rect = img.getBoundingClientRect()
            return rect.width > 100 && rect.height > 100 // Likely a stage image
          })

        const visibleComplete = imgs.filter(img => {
          const el = img as HTMLImageElement
          const style = window.getComputedStyle(el)
          return parseFloat(style.opacity) > 0.5 && el.complete && el.naturalWidth > 0
        })

        return {
          totalImages: imgs.length,
          visibleComplete: visibleComplete.length,
          allOpacities: imgs.map(img => window.getComputedStyle(img as HTMLElement).opacity),
        }
      })

      if (stageState.visibleComplete === 0 && stageState.totalImages > 0) {
        blankFrameCount++
        console.log(`Switch ${i + 1} → ${randomPill}: ⚠️  BLANK (${stageState.totalImages} images, 0 visible/complete)`)
      }

      totalSwitches++
      await page.waitForTimeout(100 + Math.random() * 100) // Random delay
    }

    console.log(`\nTotal switches: ${totalSwitches}`)
    console.log(`Blank frames detected: ${blankFrameCount}`)
    console.log(`Blank rate: ${((blankFrameCount / totalSwitches) * 100).toFixed(1)}%`)

    if (blankFrameCount > 0) {
      console.log('\n⚠️  ROOT CAUSE: Images mounting at opacity:0 before load completes')
    }
  })

  test('1.4 Height budget at iPad landscape', async ({ page }) => {
    // iPad Safari landscape with browser chrome
    await page.setViewportSize({ width: 1180, height: 820 })
    await page.goto('http://localhost:3000/zh-HK/venue')
    await page.waitForLoadState('networkidle')

    await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)

    const measurements = await page.evaluate(() => {
      const navbar = document.querySelector('nav')
      const heading = document.querySelector('h2:has-text("兩間"), h2:has-text("1T")')
      const stage = document.querySelector('[class*="stage"]') ||
                    Array.from(document.querySelectorAll('img[alt*="Space"]'))[0]?.closest('div')

      // Find panel container (the card with pills)
      const panel = document.querySelector('[class*="panel"]') ||
                    document.querySelector('button:has-text("場地裝修")')?.closest('div[class*="rounded"]')

      return {
        viewport: window.innerHeight,
        navbar: navbar?.getBoundingClientRect().height || 0,
        heading: heading?.getBoundingClientRect().height || 0,
        panel: panel?.getBoundingClientRect().height || 0,
        stage: (stage as HTMLElement)?.getBoundingClientRect().height || 0,
        navbarTop: navbar?.getBoundingClientRect().top || 0,
        headingTop: heading?.getBoundingClientRect().top || 0,
        stageBottom: (stage as HTMLElement)?.getBoundingClientRect().bottom || 0,
      }
    })

    console.log('=== 1.4 HEIGHT BUDGET (1180×820, ~690px viewport after chrome) ===')
    console.log(`Viewport height: ${measurements.viewport}px`)
    console.log(`Navbar: ${measurements.navbar.toFixed(0)}px`)
    console.log(`Heading: ${measurements.heading.toFixed(0)}px`)
    console.log(`Panel: ${measurements.panel.toFixed(0)}px`)
    console.log(`Stage: ${measurements.stage.toFixed(0)}px`)
    console.log(`\nPositions:`)
    console.log(`  Navbar top: ${measurements.navbarTop.toFixed(0)}px`)
    console.log(`  Heading top: ${measurements.headingTop.toFixed(0)}px`)
    console.log(`  Stage bottom: ${measurements.stageBottom.toFixed(0)}px`)

    const fitsInView = measurements.stageBottom <= measurements.viewport
    console.log(`\n${fitsInView ? '✓' : '⚠️'}  Section ${fitsInView ? 'FITS' : 'OVERFLOWS'} viewport`)

    if (!fitsInView) {
      const overflow = measurements.stageBottom - measurements.viewport
      console.log(`Overflow: ${overflow.toFixed(0)}px`)
    }
  })
})
