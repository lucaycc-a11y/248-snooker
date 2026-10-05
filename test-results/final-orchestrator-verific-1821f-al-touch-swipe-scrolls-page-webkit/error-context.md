# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Hero (About & Venue) >> About Hero - vertical touch swipe scrolls page
- Location: tests/final-orchestrator-verification.spec.ts:37:9

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main [ref=e2]:
    - navigation:
      - link "主頁" [ref=e3]:
        - /url: /
        - img "Space8" [ref=e4]
      - generic [ref=e5]:
        - link "主頁" [ref=e6]:
          - /url: /
        - link "預訂" [ref=e7]:
          - /url: /book
        - link "場地" [ref=e8]:
          - /url: /venue
        - link "關於" [ref=e9]:
          - /url: /about
        - link "博客" [ref=e10]:
          - /url: /blog
        - link "會員" [ref=e11]:
          - /url: /membership
      - button "登入" [ref=e12] [cursor=pointer]
    - generic [ref=e14]:
      - region "Space8 場地相片" [ref=e19]:
        - listbox "Space8 場地相片" [active] [ref=e20]:
          - generic:
            - option [selected] [ref=e21]:
              - img "球臺上的黑八球與散落的球，背景為灰藍色吸音牆" [ref=e23]
            - option [ref=e24]:
              - img "球臺袋口與星牌標誌，背景為天花的暖色間接燈光" [ref=e26]
            - option [ref=e27]:
              - img "球臺後方的休息區，設有扶手椅、沙發與小桌" [ref=e29]
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
          - paragraph: 專屬中八空間
        - generic:
          - paragraph: 好的中式八球室不應有多餘干擾。
        - list [aria-hidden] [ref=e30]:
          - listitem [ref=e31]:
            - generic [ref=e32]: "01"
          - listitem [ref=e33]:
            - generic [ref=e34]: "02"
          - listitem [ref=e35]:
            - generic [ref=e36]: "03"
      - region "零打擾，全專註。" [ref=e37]:
        - generic [ref=e38]:
          - generic:
            - heading "零打擾，全專註。" [level=2]
            - paragraph [aria-hidden]: 零打擾，全專註。
            - paragraph [aria-hidden]: 零打擾，全專註。
      - generic [ref=e44]:
        - heading "聯繫我們" [level=2] [ref=e45]
        - generic [ref=e46]:
          - generic [ref=e52]:
            - generic [ref=e53]: 地址
            - generic [ref=e54]: 香港新蒲岗大有街 32 號泰力工業中心 3 楼 05 室
          - link "WhatsApp +852 6180 8022" [ref=e55]:
            - /url: https://wa.me/85261808022
            - generic [ref=e60]:
              - generic [ref=e61]: WhatsApp
              - generic [ref=e62]: +852 6180 8022
          - link "電郵 Info@space8.com.hk" [ref=e63]:
            - /url: mailto:Info@space8.com.hk
            - generic [ref=e69]:
              - generic [ref=e70]: 電郵
              - generic [ref=e71]: Info@space8.com.hk
          - generic [ref=e77]:
            - generic [ref=e78]: 營業時間
            - generic [ref=e79]: 每日 06:00 至 24:00
        - link "WhatsApp 聯繫" [ref=e80]:
          - /url: https://wa.me/85261808022
    - generic [ref=e84]:
      - generic [ref=e85]:
        - img "Space8" [ref=e86]
        - generic [ref=e87]:
          - link "WhatsApp" [ref=e88]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e91]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]: 聯繫我們
          - link "Google Maps 導航" [ref=e99]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e100]:
              - button "Marker" [ref=e101] [cursor=pointer]
              - generic [ref=e102]:
                - link "Leaflet" [ref=e103]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e108]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e109]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e116]:
            - generic [ref=e117]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e118]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e119]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e120]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e130]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e136]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e137]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e138]
          - generic [ref=e139]:
            - generic [ref=e140]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e141]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e142]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e143]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e144]:
        - generic [ref=e145]:
          - generic [ref=e146]: 導航
          - generic [ref=e147]:
            - link "預訂" [ref=e148]:
              - /url: /book
            - link "場地" [ref=e149]:
              - /url: /venue
            - link "關於" [ref=e150]:
              - /url: /about
            - link "博客" [ref=e151]:
              - /url: /blog
            - link "會員" [ref=e152]:
              - /url: /membership
        - generic [ref=e153]:
          - generic [ref=e154]: 法律
          - generic [ref=e155]:
            - link "幫助中心" [ref=e156]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e157]:
              - /url: /legal
            - link "私隱政策" [ref=e158]:
              - /url: /privacy
      - img "Stripe" [ref=e160]
      - generic [ref=e161]:
        - paragraph [ref=e162]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e163]:
          - link "場地使用守則及條款" [ref=e164]:
            - /url: /legal
          - link "私隱政策" [ref=e165]:
            - /url: /privacy
          - link "制作團隊" [ref=e166]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e167]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - alert [ref=e170]
  - generic [ref=e173] [cursor=pointer]:
    - generic [ref=e176]: 2 errors
    - button "Hide Errors" [ref=e177]
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
  18  |         await page.mouse.wheel(0, 100)
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
> 57  |       expect(afterSwipeDown).toBeGreaterThan(initialScrollY)
      |                              ^ Error: expect(received).toBeGreaterThan(expected)
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
  119 |       // Click button 03
  120 |       await page.locator('button:has-text("03")').first().click()
  121 |       await page.waitForTimeout(800)
  122 | 
  123 |       const scroll03 = await page.evaluate(() => window.scrollY)
  124 |       expect(scroll03).toBeGreaterThan(scroll02)
  125 | 
  126 |       // Click button 01 to go back
  127 |       await page.locator('button:has-text("01")').first().click()
  128 |       await page.waitForTimeout(800)
  129 | 
  130 |       const scroll01 = await page.evaluate(() => window.scrollY)
  131 |       expect(scroll01).toBeLessThan(scroll02)
  132 | 
  133 |       console.log('Index buttons:', '01', scroll01, '02', scroll02, '03', scroll03)
  134 |     })
  135 | 
  136 |     test('About Hero - scroll up from next section re-enters smoothly', async ({ page }) => {
  137 |       await page.goto('http://localhost:3000/about')
  138 |       await page.waitForLoadState('networkidle')
  139 | 
  140 |       // Scroll past hero
  141 |       await page.evaluate(() => window.scrollTo(0, 5000))
  142 |       await page.waitForTimeout(500)
  143 | 
  144 |       const pastHero = await page.evaluate(() => window.scrollY)
  145 |       expect(pastHero).toBeGreaterThan(3000)
  146 | 
  147 |       // Scroll back up
  148 |       await page.mouse.wheel(0, -500)
  149 |       await page.waitForTimeout(300)
  150 | 
  151 |       const backInHero = await page.evaluate(() => window.scrollY)
  152 |       expect(backInHero).toBeLessThan(pastHero)
  153 |       expect(backInHero).toBeGreaterThan(0)
  154 | 
  155 |       console.log('Re-entry: past', pastHero, '→ back', backInHero)
  156 |     })
  157 | 
```