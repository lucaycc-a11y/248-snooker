# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Hero (About & Venue) >> About Hero - 60 wheel events scroll monotonically past hero
- Location: tests/final-orchestrator-verification.spec.ts:8:9

# Error details

```
Error: mouse.wheel: Mouse wheel is not supported in mobile WebKit
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - navigation [ref=e3]:
      - link "主頁" [ref=e4]:
        - /url: /
        - img "Space8" [ref=e5]
      - generic [ref=e6]:
        - button "登入" [ref=e7] [cursor=pointer]
        - button "開啟選單" [ref=e9] [cursor=pointer]
    - generic [ref=e16]:
      - region "Space8 場地相片" [ref=e21]:
        - listbox "Space8 場地相片" [ref=e22]:
          - generic:
            - option [selected] [ref=e23]:
              - img "球臺上的黑八球與散落的球，背景為灰藍色吸音牆" [ref=e25]
            - option [ref=e26]:
              - img "球臺袋口與星牌標誌，背景為天花的暖色間接燈光" [ref=e28]
            - option [ref=e29]:
              - img "球臺後方的休息區，設有扶手椅、沙發與小桌" [ref=e31]
        - generic:
          - generic:
            - generic:
              - generic:
                - generic: 關於
                - generic:
                  - img "SPACE8"
              - generic: 獨享私密
              - paragraph: 好的中式桌球室不應有多餘干擾。
        - generic:
          - paragraph: 01 / 03
          - paragraph: 專屬中八空間
          - paragraph:
            - generic: 好的中式八球室不應有多餘干擾。
      - region "零打擾，全專註。" [ref=e32]:
        - generic [ref=e33]:
          - generic:
            - heading "零打擾，全專註。" [level=2]
            - paragraph [aria-hidden]: 零打擾，全專註。
            - paragraph [aria-hidden]: 零打擾，全專註。
      - generic [ref=e39]:
        - heading "聯繫我們" [level=2] [ref=e40]
        - generic [ref=e41]:
          - generic [ref=e47]:
            - generic [ref=e48]: 地址
            - generic [ref=e49]: 香港新蒲岗大有街 32 號泰力工業中心 3 楼 05 室
          - link "WhatsApp +852 6180 8022" [ref=e50]:
            - /url: https://wa.me/85261808022
            - generic [ref=e55]:
              - generic [ref=e56]: WhatsApp
              - generic [ref=e57]: +852 6180 8022
          - link "電郵 Info@space8.com.hk" [ref=e58]:
            - /url: mailto:Info@space8.com.hk
            - generic [ref=e64]:
              - generic [ref=e65]: 電郵
              - generic [ref=e66]: Info@space8.com.hk
          - generic [ref=e72]:
            - generic [ref=e73]: 營業時間
            - generic [ref=e74]: 每日 06:00 至 24:00
        - link "WhatsApp 聯繫" [ref=e75]:
          - /url: https://wa.me/85261808022
    - generic [ref=e79]:
      - generic [ref=e80]:
        - img "Space8" [ref=e81]
        - generic [ref=e82]:
          - link "WhatsApp" [ref=e83]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e86]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]: 聯繫我們
          - link "Google Maps 導航" [ref=e94]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e95]:
              - button "Marker" [ref=e96] [cursor=pointer]
              - generic [ref=e97]:
                - link "Leaflet" [ref=e98]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e103]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e104]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e111]:
            - generic [ref=e112]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e113]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e114]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e115]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e125]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e131]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e132]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e133]
          - generic [ref=e134]:
            - generic [ref=e135]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e136]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e137]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e138]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e139]:
        - generic [ref=e140]:
          - generic [ref=e141]: 導航
          - generic [ref=e142]:
            - link "預訂" [ref=e143]:
              - /url: /book
            - link "場地" [ref=e144]:
              - /url: /venue
            - link "關於" [ref=e145]:
              - /url: /about
            - link "博客" [ref=e146]:
              - /url: /blog
            - link "會員" [ref=e147]:
              - /url: /membership
        - generic [ref=e148]:
          - generic [ref=e149]: 法律
          - generic [ref=e150]:
            - link "幫助中心" [ref=e151]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e152]:
              - /url: /legal
            - link "私隱政策" [ref=e153]:
              - /url: /privacy
      - img "Stripe" [ref=e155]
      - generic [ref=e156]:
        - paragraph [ref=e157]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e158]:
          - link "場地使用守則及條款" [ref=e159]:
            - /url: /legal
          - link "私隱政策" [ref=e160]:
            - /url: /privacy
          - link "制作團隊" [ref=e161]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e162]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - alert [ref=e165]
  - generic [ref=e168] [cursor=pointer]:
    - generic [ref=e171]: 2 errors
    - button "Hide Errors" [ref=e172]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | import crypto from 'crypto'
  3   | import fs from 'fs'
  4   | import path from 'path'
  5   | 
  6   | test.describe('Final Orchestrator Verification', () => {
  7   |   test.describe('Hero (About & Venue)', () => {
  8   |     test('About Hero - 60 wheel events scroll monotonically past hero', async ({ page }) => {
  9   |       await page.goto('http://localhost:3000/about')
  10  |       await page.waitForLoadState('networkidle')
  11  | 
  12  |       const scrollYValues: number[] = []
  13  |       let previousScrollY = await page.evaluate(() => window.scrollY)
  14  |       scrollYValues.push(previousScrollY)
  15  | 
  16  |       // Dispatch 60 wheel events
  17  |       for (let i = 0; i < 60; i++) {
> 18  |         await page.mouse.wheel(0, 100)
      |                          ^ Error: mouse.wheel: Mouse wheel is not supported in mobile WebKit
  19  |         await page.waitForTimeout(200)
  20  | 
  21  |         const currentScrollY = await page.evaluate(() => window.scrollY)
  22  |         scrollYValues.push(currentScrollY)
  23  | 
  24  |         // Verify monotonic increase (or equal if at bottom)
  25  |         expect(currentScrollY).toBeGreaterThanOrEqual(previousScrollY)
  26  |         previousScrollY = currentScrollY
  27  |       }
  28  | 
  29  |       // Verify we scrolled past hero section
  30  |       const finalScrollY = scrollYValues[scrollYValues.length - 1]
  31  |       expect(finalScrollY).toBeGreaterThan(2000) // Hero should be passed
  32  | 
  33  |       console.log('Scroll progression sample:', scrollYValues.filter((_, i) => i % 10 === 0))
  34  |       console.log('Final scroll position:', finalScrollY)
  35  |     })
  36  | 
  37  |     test('About Hero - vertical touch swipe scrolls page', async ({ page, browserName }) => {
  38  |       if (browserName !== 'webkit') test.skip()
  39  | 
  40  |       const iPad = {
  41  |         name: 'iPad Pro landscape',
  42  |         viewport: { width: 1194, height: 834 },
  43  |         hasTouch: true,
  44  |       }
  45  |       await page.setViewportSize(iPad.viewport)
  46  |       await page.goto('http://localhost:3000/about')
  47  |       await page.waitForLoadState('networkidle')
  48  | 
  49  |       const initialScrollY = await page.evaluate(() => window.scrollY)
  50  | 
  51  |       // Vertical swipe down
  52  |       await page.touchscreen.tap(600, 300)
  53  |       await page.touchscreen.tap(600, 100)
  54  |       await page.waitForTimeout(500)
  55  | 
  56  |       const afterSwipeDown = await page.evaluate(() => window.scrollY)
  57  |       expect(afterSwipeDown).toBeGreaterThan(initialScrollY)
  58  | 
  59  |       // Swipe back up
  60  |       await page.touchscreen.tap(600, 100)
  61  |       await page.touchscreen.tap(600, 400)
  62  |       await page.waitForTimeout(500)
  63  | 
  64  |       const afterSwipeUp = await page.evaluate(() => window.scrollY)
  65  |       expect(afterSwipeUp).toBeLessThan(afterSwipeDown)
  66  | 
  67  |       console.log('Touch swipe: initial', initialScrollY, '→ down', afterSwipeDown, '→ up', afterSwipeUp)
  68  |     })
  69  | 
  70  |     test('About Hero - Space/PageDown/arrows scroll through points', async ({ page }) => {
  71  |       await page.goto('http://localhost:3000/about')
  72  |       await page.waitForLoadState('networkidle')
  73  | 
  74  |       // Focus body
  75  |       await page.evaluate(() => document.body.focus())
  76  | 
  77  |       const initialScrollY = await page.evaluate(() => window.scrollY)
  78  | 
  79  |       // Press Space 3 times
  80  |       await page.keyboard.press('Space')
  81  |       await page.waitForTimeout(300)
  82  |       await page.keyboard.press('Space')
  83  |       await page.waitForTimeout(300)
  84  |       await page.keyboard.press('Space')
  85  |       await page.waitForTimeout(300)
  86  | 
  87  |       const afterSpace = await page.evaluate(() => window.scrollY)
  88  |       expect(afterSpace).toBeGreaterThan(initialScrollY)
  89  | 
  90  |       // Press PageDown
  91  |       await page.keyboard.press('PageDown')
  92  |       await page.waitForTimeout(300)
  93  | 
  94  |       const afterPageDown = await page.evaluate(() => window.scrollY)
  95  |       expect(afterPageDown).toBeGreaterThan(afterSpace)
  96  | 
  97  |       console.log('Keyboard: initial', initialScrollY, '→ Space×3', afterSpace, '→ PageDown', afterPageDown)
  98  |     })
  99  | 
  100 |     test('About Hero - index buttons 01/02/03 scroll to correct positions', async ({ page }) => {
  101 |       await page.goto('http://localhost:3000/about')
  102 |       await page.waitForLoadState('networkidle')
  103 | 
  104 |       // Find index buttons (if they exist)
  105 |       const indexButtons = await page.locator('button:has-text("01"), button:has-text("02"), button:has-text("03")').count()
  106 | 
  107 |       if (indexButtons === 0) {
  108 |         console.log('No index buttons found - skipping test')
  109 |         return
  110 |       }
  111 | 
  112 |       // Click button 02
  113 |       await page.locator('button:has-text("02")').first().click()
  114 |       await page.waitForTimeout(800) // Allow smooth scroll
  115 | 
  116 |       const scroll02 = await page.evaluate(() => window.scrollY)
  117 |       expect(scroll02).toBeGreaterThan(500)
  118 | 
```