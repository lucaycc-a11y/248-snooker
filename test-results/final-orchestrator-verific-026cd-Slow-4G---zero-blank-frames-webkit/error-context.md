# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Room Viewer Compare >> 30 random pill switches under Slow 4G - zero blank frames
- Location: tests/final-orchestrator-verification.spec.ts:453:9

# Error details

```
Error: browserContext.newCDPSession: CDP session is only available in Chromium
```

# Test source

```ts
  357 |       const eternityOnly = await page.screenshot({ path: 'test-results/compare-p0-eternity.png' })
  358 |       console.log('p=0 screenshot saved')
  359 | 
  360 |       // Test p=50 (split view)
  361 |       await page.evaluate(() => {
  362 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  363 |         if (slider) {
  364 |           slider.value = '50'
  365 |           slider.dispatchEvent(new Event('input', { bubbles: true }))
  366 |         }
  367 |       })
  368 |       await page.waitForTimeout(500)
  369 | 
  370 |       const splitView = await page.screenshot({ path: 'test-results/compare-p50-split.png' })
  371 |       console.log('p=50 screenshot saved')
  372 |     })
  373 | 
  374 |     test('Screenshots at p=25/50/75 show two different photos', async ({ page, browserName }) => {
  375 |       if (browserName !== 'webkit') test.skip()
  376 | 
  377 |       const iPad = {
  378 |         name: 'iPad Pro landscape',
  379 |         viewport: { width: 1194, height: 834 },
  380 |         hasTouch: true,
  381 |       }
  382 |       await page.setViewportSize(iPad.viewport)
  383 | 
  384 |       await page.goto('http://localhost:3000/venue')
  385 |       await page.waitForLoadState('networkidle')
  386 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
  387 | 
  388 |       const positions = [25, 50, 75]
  389 | 
  390 |       for (const p of positions) {
  391 |         await page.evaluate((pos) => {
  392 |           const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  393 |           if (slider) {
  394 |             slider.value = String(pos)
  395 |             slider.dispatchEvent(new Event('input', { bubbles: true }))
  396 |           }
  397 |         }, p)
  398 |         await page.waitForTimeout(500)
  399 | 
  400 |         await page.screenshot({ path: `test-results/compare-p${p}.png` })
  401 |         console.log(`p=${p} screenshot saved`)
  402 |       }
  403 |     })
  404 | 
  405 |     test('Handle and thumb sync, keyboard navigation works', async ({ page }) => {
  406 |       await page.goto('http://localhost:3000/venue')
  407 |       await page.waitForLoadState('networkidle')
  408 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
  409 | 
  410 |       // Get initial slider value
  411 |       const initialValue = await page.evaluate(() => {
  412 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  413 |         return slider ? parseInt(slider.value) : 50
  414 |       })
  415 | 
  416 |       // Press ArrowRight
  417 |       await page.locator('input[type="range"]').first().focus()
  418 |       await page.keyboard.press('ArrowRight')
  419 |       await page.waitForTimeout(200)
  420 | 
  421 |       const afterRight = await page.evaluate(() => {
  422 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  423 |         return slider ? parseInt(slider.value) : 50
  424 |       })
  425 | 
  426 |       expect(afterRight).toBeGreaterThan(initialValue)
  427 | 
  428 |       // Press Home (should go to 0)
  429 |       await page.keyboard.press('Home')
  430 |       await page.waitForTimeout(200)
  431 | 
  432 |       const afterHome = await page.evaluate(() => {
  433 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  434 |         return slider ? parseInt(slider.value) : 50
  435 |       })
  436 | 
  437 |       expect(afterHome).toBe(0)
  438 | 
  439 |       // Press End (should go to 100)
  440 |       await page.keyboard.press('End')
  441 |       await page.waitForTimeout(200)
  442 | 
  443 |       const afterEnd = await page.evaluate(() => {
  444 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  445 |         return slider ? parseInt(slider.value) : 50
  446 |       })
  447 | 
  448 |       expect(afterEnd).toBe(100)
  449 | 
  450 |       console.log('Keyboard nav:', initialValue, '→ Right', afterRight, '→ Home', afterHome, '→ End', afterEnd)
  451 |     })
  452 | 
  453 |     test('30 random pill switches under Slow 4G - zero blank frames', async ({ page, browserName, context }) => {
  454 |       if (browserName !== 'webkit') test.skip()
  455 | 
  456 |       // Simulate Slow 4G
> 457 |       const client = await context.newCDPSession(page)
      |                                    ^ Error: browserContext.newCDPSession: CDP session is only available in Chromium
  458 |       await client.send('Network.emulateNetworkConditions', {
  459 |         offline: false,
  460 |         downloadThroughput: 50 * 1024 / 8, // 50kb/s
  461 |         uploadThroughput: 50 * 1024 / 8,
  462 |         latency: 2000, // 2s
  463 |       })
  464 | 
  465 |       await page.goto('http://localhost:3000/venue')
  466 |       await page.waitForLoadState('networkidle')
  467 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
  468 | 
  469 |       let blankFrameCount = 0
  470 | 
  471 |       for (let i = 0; i < 30; i++) {
  472 |         // Click random pill
  473 |         const pills = await page.locator('[data-testid^="pill-"]').count()
  474 |         const randomPill = Math.floor(Math.random() * pills)
  475 | 
  476 |         await page.locator(`[data-testid^="pill-"]`).nth(randomPill).click()
  477 | 
  478 |         // Check for blank stage during transition
  479 |         const hasBlankFrame = await page.evaluate(() => {
  480 |           const images = Array.from(document.querySelectorAll('[data-testid="room-viewer"] img'))
  481 |           const allHidden = images.every(img => {
  482 |             const style = window.getComputedStyle(img as HTMLElement)
  483 |             return style.opacity === '0' || style.display === 'none'
  484 |           })
  485 |           return allHidden
  486 |         })
  487 | 
  488 |         if (hasBlankFrame) blankFrameCount++
  489 | 
  490 |         await page.waitForTimeout(100)
  491 |       }
  492 | 
  493 |       console.log(`Blank frames detected: ${blankFrameCount} / 30`)
  494 |       expect(blankFrameCount).toBe(0)
  495 |     })
  496 | 
  497 |     test('Baked-in title check', async ({ page }) => {
  498 |       await page.goto('http://localhost:3000/venue')
  499 |       await page.waitForLoadState('networkidle')
  500 | 
  501 |       const hasDOMTitle = await page.evaluate(() => {
  502 |         const textElements = Array.from(document.querySelectorAll('*'))
  503 |         return textElements.some(el => {
  504 |           const text = el.textContent || ''
  505 |           return text.includes('SPACE INFINITY') || text.includes('SPACE ETERNITY')
  506 |         })
  507 |       })
  508 | 
  509 |       console.log('Title in DOM elements:', hasDOMTitle)
  510 |       console.log(hasDOMTitle ? 'Title is CSS overlay (correct)' : 'Title may be baked into JPG (needs verification)')
  511 |     })
  512 |   })
  513 | 
  514 |   test.describe('Code Quality', () => {
  515 |     test('No raw i18n keys visible', async ({ page }) => {
  516 |       await page.goto('http://localhost:3000/about')
  517 |       await page.waitForLoadState('networkidle')
  518 | 
  519 |       const bodyText = await page.textContent('body')
  520 |       const hasRawKeys = /\b(about|venue|ui)\.\w+\.\w+/.test(bodyText || '')
  521 | 
  522 |       expect(hasRawKeys).toBe(false)
  523 |       console.log('Raw i18n keys found:', hasRawKeys)
  524 |     })
  525 | 
  526 |     test('No horizontal overflow', async ({ page }) => {
  527 |       await page.goto('http://localhost:3000/about')
  528 |       await page.waitForLoadState('networkidle')
  529 | 
  530 |       const hasOverflow = await page.evaluate(() => {
  531 |         return document.documentElement.scrollWidth > document.documentElement.clientWidth
  532 |       })
  533 | 
  534 |       expect(hasOverflow).toBe(false)
  535 |       console.log('Horizontal overflow:', hasOverflow)
  536 |     })
  537 |   })
  538 | })
  539 | 
```