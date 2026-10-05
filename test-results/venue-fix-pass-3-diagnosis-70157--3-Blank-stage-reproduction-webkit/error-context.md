# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: venue-fix-pass-3-diagnosis.spec.ts >> Venue Fix Pass 3 - Part 1 Diagnosis >> 1.3 Blank stage reproduction
- Location: tests/venue-fix-pass-3-diagnosis.spec.ts:115:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.scrollIntoViewIfNeeded: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('text=兩間 1T 獨立球室')

```

# Page snapshot

```yaml
- generic [active]:
  - status "Loading" [ref=e2]
  - region "Notifications alt+T"
```

# Test source

```ts
  16  |     if (!(await stage.isVisible())) {
  17  |       console.log('Stage not found with testid, trying alternative selector')
  18  |       // Alternative: find by structure
  19  |     }
  20  | 
  21  |     // Hide all siblings of the image to isolate it
  22  |     await page.evaluate(() => {
  23  |       const imgs = document.querySelectorAll('img[alt*="Space Infinity"], img[alt*="Space Eternity"]')
  24  |       imgs.forEach(img => {
  25  |         const parent = img.parentElement
  26  |         if (parent) {
  27  |           // Hide all siblings
  28  |           Array.from(parent.children).forEach(child => {
  29  |             if (child !== img) {
  30  |               ;(child as HTMLElement).style.display = 'none'
  31  |             }
  32  |           })
  33  |           // Remove any overlay text elements
  34  |           parent.querySelectorAll('h1, h2, h3, div[class*="title"], span[class*="title"]').forEach(el => {
  35  |             ;(el as HTMLElement).style.display = 'none'
  36  |           })
  37  |         }
  38  |       })
  39  |     })
  40  | 
  41  |     await page.waitForTimeout(500)
  42  | 
  43  |     // Take screenshot of isolated image
  44  |     await page.screenshot({
  45  |       path: 'tests/screenshots/venue-isolated-panorama.png',
  46  |       fullPage: false,
  47  |     })
  48  | 
  49  |     // Check if any overlay text elements exist in DOM
  50  |     const overlayText = await page.locator('text=/SPACE (INFINITY|ETERNITY)/i').count()
  51  | 
  52  |     console.log('=== 1.1 BAKED-IN TEXT DIAGNOSIS ===')
  53  |     console.log(`Overlay text elements found in DOM: ${overlayText}`)
  54  |     console.log('Screenshot saved: tests/screenshots/venue-isolated-panorama.png')
  55  |     console.log('Visual inspection required: Does the screenshot show "SPACE INFINITY/ETERNITY" text?')
  56  |     console.log('If YES → text is baked into JPG pixels (cannot remove without new source)')
  57  |     console.log('If NO → text is DOM/CSS overlay (can be removed)')
  58  |   })
  59  | 
  60  |   test('1.2 Stage image fit diagnosis', async ({ page }) => {
  61  |     await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
  62  |     await page.waitForTimeout(1000)
  63  | 
  64  |     const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']
  65  | 
  66  |     console.log('=== 1.2 STAGE IMAGE FIT DIAGNOSIS ===')
  67  | 
  68  |     for (const pillText of pills) {
  69  |       await page.locator(`button:has-text("${pillText}")`).first().click()
  70  |       await page.waitForTimeout(800)
  71  | 
  72  |       const images = await page.locator('img[alt*="Space"], img[alt*="設備"], img[alt*="iPad"]').all()
  73  | 
  74  |       for (let i = 0; i < Math.min(images.length, 2); i++) {
  75  |         const img = images[i]
  76  |         const isVisible = await img.isVisible()
  77  |         if (!isVisible) continue
  78  | 
  79  |         const imgData = await img.evaluate((el: HTMLImageElement) => {
  80  |           const rect = el.getBoundingClientRect()
  81  |           const parent = el.closest('[class*="stage"]') || el.parentElement
  82  |           const parentRect = parent?.getBoundingClientRect()
  83  | 
  84  |           return {
  85  |             naturalWidth: el.naturalWidth,
  86  |             naturalHeight: el.naturalHeight,
  87  |             objectFit: window.getComputedStyle(el).objectFit,
  88  |             renderedWidth: rect.width,
  89  |             renderedHeight: rect.height,
  90  |             stageWidth: parentRect?.width || 0,
  91  |             stageHeight: parentRect?.height || 0,
  92  |             aspectRatio: el.naturalWidth / el.naturalHeight,
  93  |             alt: el.alt,
  94  |           }
  95  |         })
  96  | 
  97  |         console.log(`\nPill: ${pillText}, Image ${i + 1}:`)
  98  |         console.log(`  Natural: ${imgData.naturalWidth}×${imgData.naturalHeight} (${imgData.aspectRatio.toFixed(3)})`)
  99  |         console.log(`  Stage box: ${imgData.stageWidth.toFixed(0)}×${imgData.stageHeight.toFixed(0)}`)
  100 |         console.log(`  Rendered: ${imgData.renderedWidth.toFixed(0)}×${imgData.renderedHeight.toFixed(0)}`)
  101 |         console.log(`  object-fit: ${imgData.objectFit}`)
  102 |         console.log(`  Alt: ${imgData.alt}`)
  103 | 
  104 |         // Check if letterboxed
  105 |         const fillsWidth = Math.abs(imgData.renderedWidth - imgData.stageWidth) < 2
  106 |         const fillsHeight = Math.abs(imgData.renderedHeight - imgData.stageHeight) < 2
  107 | 
  108 |         if (!fillsWidth || !fillsHeight) {
  109 |           console.log(`  ⚠️  LETTERBOXED: Does not fill stage (width: ${fillsWidth}, height: ${fillsHeight})`)
  110 |         }
  111 |       }
  112 |     }
  113 |   })
  114 | 
  115 |   test('1.3 Blank stage reproduction', async ({ page }) => {
> 116 |     await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
      |                                           ^ Error: locator.scrollIntoViewIfNeeded: Test timeout of 30000ms exceeded.
  117 |     await page.waitForTimeout(1000)
  118 | 
  119 |     // Throttle network to Slow 4G
  120 |     const client = await page.context().newCDPSession(page)
  121 |     await client.send('Network.emulateNetworkConditions', {
  122 |       offline: false,
  123 |       downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps
  124 |       uploadThroughput: (3 * 1024 * 1024) / 8,
  125 |       latency: 400,
  126 |     })
  127 | 
  128 |     console.log('=== 1.3 BLANK STAGE DIAGNOSIS ===')
  129 |     console.log('Network throttled to Slow 4G')
  130 | 
  131 |     const pills = ['場地裝修', '舒適自在', '專業設備', '科技體驗']
  132 |     let blankFrameCount = 0
  133 |     let totalSwitches = 0
  134 | 
  135 |     for (let i = 0; i < 30; i++) {
  136 |       const randomPill = pills[Math.floor(Math.random() * pills.length)]
  137 |       await page.locator(`button:has-text("${randomPill}")`).first().click()
  138 | 
  139 |       // Check stage immediately after click
  140 |       const stageState = await page.evaluate(() => {
  141 |         const imgs = Array.from(document.querySelectorAll('img[alt*="Space"], img[alt*="設備"], img[alt*="iPad"]'))
  142 |           .filter(img => {
  143 |             const rect = img.getBoundingClientRect()
  144 |             return rect.width > 100 && rect.height > 100 // Likely a stage image
  145 |           })
  146 | 
  147 |         const visibleComplete = imgs.filter(img => {
  148 |           const el = img as HTMLImageElement
  149 |           const style = window.getComputedStyle(el)
  150 |           return parseFloat(style.opacity) > 0.5 && el.complete && el.naturalWidth > 0
  151 |         })
  152 | 
  153 |         return {
  154 |           totalImages: imgs.length,
  155 |           visibleComplete: visibleComplete.length,
  156 |           allOpacities: imgs.map(img => window.getComputedStyle(img as HTMLElement).opacity),
  157 |         }
  158 |       })
  159 | 
  160 |       if (stageState.visibleComplete === 0 && stageState.totalImages > 0) {
  161 |         blankFrameCount++
  162 |         console.log(`Switch ${i + 1} → ${randomPill}: ⚠️  BLANK (${stageState.totalImages} images, 0 visible/complete)`)
  163 |       }
  164 | 
  165 |       totalSwitches++
  166 |       await page.waitForTimeout(100 + Math.random() * 100) // Random delay
  167 |     }
  168 | 
  169 |     console.log(`\nTotal switches: ${totalSwitches}`)
  170 |     console.log(`Blank frames detected: ${blankFrameCount}`)
  171 |     console.log(`Blank rate: ${((blankFrameCount / totalSwitches) * 100).toFixed(1)}%`)
  172 | 
  173 |     if (blankFrameCount > 0) {
  174 |       console.log('\n⚠️  ROOT CAUSE: Images mounting at opacity:0 before load completes')
  175 |     }
  176 |   })
  177 | 
  178 |   test('1.4 Height budget at iPad landscape', async ({ page }) => {
  179 |     // iPad Safari landscape with browser chrome
  180 |     await page.setViewportSize({ width: 1180, height: 820 })
  181 |     await page.goto('http://localhost:3000/zh-HK/venue')
  182 |     await page.waitForLoadState('networkidle')
  183 | 
  184 |     await page.locator('text=兩間 1T 獨立球室').scrollIntoViewIfNeeded()
  185 |     await page.waitForTimeout(1000)
  186 | 
  187 |     const measurements = await page.evaluate(() => {
  188 |       const navbar = document.querySelector('nav')
  189 |       const heading = document.querySelector('h2:has-text("兩間"), h2:has-text("1T")')
  190 |       const stage = document.querySelector('[class*="stage"]') ||
  191 |                     Array.from(document.querySelectorAll('img[alt*="Space"]'))[0]?.closest('div')
  192 | 
  193 |       // Find panel container (the card with pills)
  194 |       const panel = document.querySelector('[class*="panel"]') ||
  195 |                     document.querySelector('button:has-text("場地裝修")')?.closest('div[class*="rounded"]')
  196 | 
  197 |       return {
  198 |         viewport: window.innerHeight,
  199 |         navbar: navbar?.getBoundingClientRect().height || 0,
  200 |         heading: heading?.getBoundingClientRect().height || 0,
  201 |         panel: panel?.getBoundingClientRect().height || 0,
  202 |         stage: (stage as HTMLElement)?.getBoundingClientRect().height || 0,
  203 |         navbarTop: navbar?.getBoundingClientRect().top || 0,
  204 |         headingTop: heading?.getBoundingClientRect().top || 0,
  205 |         stageBottom: (stage as HTMLElement)?.getBoundingClientRect().bottom || 0,
  206 |       }
  207 |     })
  208 | 
  209 |     console.log('=== 1.4 HEIGHT BUDGET (1180×820, ~690px viewport after chrome) ===')
  210 |     console.log(`Viewport height: ${measurements.viewport}px`)
  211 |     console.log(`Navbar: ${measurements.navbar.toFixed(0)}px`)
  212 |     console.log(`Heading: ${measurements.heading.toFixed(0)}px`)
  213 |     console.log(`Panel: ${measurements.panel.toFixed(0)}px`)
  214 |     console.log(`Stage: ${measurements.stage.toFixed(0)}px`)
  215 |     console.log(`\nPositions:`)
  216 |     console.log(`  Navbar top: ${measurements.navbarTop.toFixed(0)}px`)
```