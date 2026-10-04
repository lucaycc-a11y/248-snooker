# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: venue-hero-overlap.spec.ts >> No overlaps at 1024px (Desktop Small)
- Location: tests/venue-hero-overlap.spec.ts:14:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 60000ms exceeded.
=========================== logs ===========================
  "commit" event fired
  "domcontentloaded" event fired
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - status "Loading" [ref=f1e3]
  - region "Notifications alt+T"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | const viewports = [
  4   |   { width: 390, height: 844, name: 'iPhone' },
  5   |   { width: 820, height: 1180, name: 'iPad' },
  6   |   { width: 1024, height: 768, name: 'Desktop Small' },
  7   |   { width: 1440, height: 900, name: 'Desktop Medium' },
  8   |   { width: 1920, height: 1080, name: 'Desktop Large' }
  9   | ]
  10  | 
  11  | const scrollPositions = [0, 0.25, 0.5, 0.75, 1.0]
  12  | 
  13  | for (const vp of viewports) {
  14  |   test(`No overlaps at ${vp.width}px (${vp.name})`, async ({ page }) => {
  15  |     test.setTimeout(60000) // Increase timeout for client-side rendering
  16  | 
  17  |     await page.setViewportSize({ width: vp.width, height: vp.height })
  18  |     await page.goto('http://localhost:3001/zh-HK/venue')
  19  | 
  20  |     // Wait for hero to load - check for images to appear (client component)
> 21  |     await page.waitForLoadState('networkidle')
      |                ^ Error: page.waitForLoadState: Test timeout of 60000ms exceeded.
  22  |     await page.waitForSelector('img[alt="場地內部環境"]', { timeout: 15000 })
  23  |     await page.waitForTimeout(2000) // Let animations and hydration settle
  24  | 
  25  |     for (const scroll of scrollPositions) {
  26  |       await page.evaluate((s) => {
  27  |         window.scrollTo(0, s * document.body.scrollHeight)
  28  |       }, scroll)
  29  |       await page.waitForTimeout(500) // Animation settle
  30  | 
  31  |       const textBox = await page.locator('h1').first().boundingBox()
  32  |       if (!textBox) {
  33  |         console.warn('Text box not found at scroll position', scroll)
  34  |         continue
  35  |       }
  36  | 
  37  |       const photos = await page.locator('img[alt*="環境"], img[alt*="特寫"], img[alt*="細節"], img[alt*="設施"]').all()
  38  | 
  39  |       for (let i = 0; i < photos.length; i++) {
  40  |         const photoBox = await photos[i].boundingBox()
  41  |         if (!photoBox) continue
  42  | 
  43  |         // Check text overlap (with 24px buffer)
  44  |         const overlapsText = (
  45  |           photoBox.x < textBox.x + textBox.width + 24 &&
  46  |           photoBox.x + photoBox.width > textBox.x - 24 &&
  47  |           photoBox.y < textBox.y + textBox.height + 24 &&
  48  |           photoBox.y + photoBox.height > textBox.y - 24
  49  |         )
  50  | 
  51  |         expect(overlapsText, `Photo ${i} overlaps text at scroll ${scroll}`).toBe(false)
  52  | 
  53  |         // Check photo-photo overlap (require 8px+ gap)
  54  |         for (let j = i + 1; j < photos.length; j++) {
  55  |           const otherBox = await photos[j].boundingBox()
  56  |           if (!otherBox) continue
  57  | 
  58  |           const overlapsPhoto = (
  59  |             photoBox.x < otherBox.x + otherBox.width - 8 &&
  60  |             photoBox.x + photoBox.width > otherBox.x + 8 &&
  61  |             photoBox.y < otherBox.y + otherBox.height - 8 &&
  62  |             photoBox.y + photoBox.height > otherBox.y + 8
  63  |           )
  64  | 
  65  |           expect(overlapsPhoto, `Photo ${i} overlaps photo ${j} at scroll ${scroll}`).toBe(false)
  66  |         }
  67  | 
  68  |         // Check viewport bounds
  69  |         expect(photoBox.x >= 0, `Photo ${i} extends left of viewport`).toBe(true)
  70  |         expect(photoBox.y >= 0, `Photo ${i} extends top of viewport`).toBe(true)
  71  |         expect(photoBox.x + photoBox.width <= vp.width, `Photo ${i} extends right of viewport`).toBe(true)
  72  |         expect(photoBox.y + photoBox.height <= vp.height, `Photo ${i} extends bottom of viewport`).toBe(true)
  73  |       }
  74  |     }
  75  |   })
  76  | }
  77  | 
  78  | test('Correct photo count per viewport', async ({ page }) => {
  79  |   test.setTimeout(60000)
  80  | 
  81  |   // Desktop: 8 photos
  82  |   await page.setViewportSize({ width: 1440, height: 900 })
  83  |   await page.goto('http://localhost:3001/zh-HK/venue')
  84  |   await page.waitForLoadState('networkidle')
  85  |   await page.waitForSelector('img[alt="場地內部環境"]', { timeout: 15000 })
  86  |   await page.waitForTimeout(2000)
  87  | 
  88  |   let photoCount = await page.locator('img[alt*="環境"], img[alt*="特寫"], img[alt*="細節"], img[alt*="設施"]').count()
  89  |   expect(photoCount, 'Desktop should show 8 photos').toBe(8)
  90  | 
  91  |   // Tablet: 6 photos
  92  |   await page.setViewportSize({ width: 820, height: 1180 })
  93  |   await page.waitForTimeout(1000)
  94  |   photoCount = await page.locator('img[alt*="環境"], img[alt*="特寫"], img[alt*="細節"], img[alt*="設施"]').count()
  95  |   expect(photoCount, 'Tablet should show 6 photos').toBe(6)
  96  | 
  97  |   // Mobile: 4 photos
  98  |   await page.setViewportSize({ width: 390, height: 844 })
  99  |   await page.waitForTimeout(1000)
  100 |   photoCount = await page.locator('img[alt*="環境"], img[alt*="特寫"], img[alt*="細節"], img[alt*="設施"]').count()
  101 |   expect(photoCount, 'Mobile should show 4 photos').toBe(4)
  102 | })
  103 | 
  104 | test('Parallax only on desktop with pointer', async ({ page }) => {
  105 |   test.setTimeout(60000)
  106 | 
  107 |   await page.setViewportSize({ width: 1440, height: 900 })
  108 |   await page.goto('http://localhost:3001/zh-HK/venue')
  109 |   await page.waitForLoadState('networkidle')
  110 |   await page.waitForSelector('img[alt="場地內部環境"]', { timeout: 15000 })
  111 |   await page.waitForTimeout(2000)
  112 | 
  113 |   // Scroll to spread state
  114 |   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.96))
  115 |   await page.waitForTimeout(1000)
  116 | 
  117 |   const photo = page.locator('img[alt*="環境"], img[alt*="特寫"], img[alt*="細節"], img[alt*="設施"]').first()
  118 |   const initialBox = await photo.boundingBox()
  119 | 
  120 |   if (!initialBox) throw new Error('Photo not found')
  121 | 
```