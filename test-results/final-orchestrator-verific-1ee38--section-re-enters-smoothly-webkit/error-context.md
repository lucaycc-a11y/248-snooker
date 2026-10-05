# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Hero (About & Venue) >> About Hero - scroll up from next section re-enters smoothly
- Location: tests/final-orchestrator-verification.spec.ts:136:9

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
            - heading "零打擾，全專註。" [level=2]:
              - generic [aria-hidden]:
                - generic: 零
                - generic: 打
                - generic: 擾
              - generic [aria-hidden]: ，
              - generic [aria-hidden]:
                - generic: 全
                - generic: 專
                - generic: 注
                - generic: 。
            - paragraph [aria-hidden]: 零打擾，全專註。
            - paragraph [aria-hidden]: 零打擾，全專註。
        - generic [ref=e36]:
          - paragraph [ref=e37]:
            - text: 一鍵預訂專屬球臺，
            - strong [ref=e38]: 隨時隨地開局。
            - strong [ref=e39]: 由預訂、付款到入場，全程自助，無需等候。
          - generic [ref=e40]:
            - generic [ref=e41]:
              - paragraph [ref=e42]: "01"
              - paragraph [ref=e43]: 選擇時段
            - generic [ref=e44]:
              - paragraph [ref=e45]: "02"
              - paragraph [ref=e46]: 即時付款
            - generic [ref=e47]:
              - paragraph [ref=e48]: "03"
              - paragraph [ref=e49]: 掃碼入場
      - generic [ref=e51]:
        - heading "聯繫我們" [level=2] [ref=e52]
        - generic [ref=e53]:
          - generic [ref=e59]:
            - generic [ref=e60]: 地址
            - generic [ref=e61]: 香港新蒲岗大有街 32 號泰力工業中心 3 楼 05 室
          - link "WhatsApp +852 6180 8022" [ref=e62]:
            - /url: https://wa.me/85261808022
            - generic [ref=e67]:
              - generic [ref=e68]: WhatsApp
              - generic [ref=e69]: +852 6180 8022
          - link "電郵 Info@space8.com.hk" [ref=e70]:
            - /url: mailto:Info@space8.com.hk
            - generic [ref=e76]:
              - generic [ref=e77]: 電郵
              - generic [ref=e78]: Info@space8.com.hk
          - generic [ref=e84]:
            - generic [ref=e85]: 營業時間
            - generic [ref=e86]: 每日 06:00 至 24:00
        - link "WhatsApp 聯繫" [ref=e87]:
          - /url: https://wa.me/85261808022
    - generic [ref=e91]:
      - generic [ref=e92]:
        - img "Space8" [ref=e93]
        - generic [ref=e94]:
          - link "WhatsApp" [ref=e95]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e98]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e102]:
        - generic [ref=e103]:
          - generic [ref=e104]: 聯繫我們
          - link "Google Maps 導航" [ref=e106]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e107]:
              - button "Marker" [ref=e108] [cursor=pointer]
              - generic [ref=e109]:
                - link "Leaflet" [ref=e110]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e115]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e116]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e123]:
            - generic [ref=e124]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e125]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e126]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e127]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e137]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e143]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e144]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e145]
          - generic [ref=e146]:
            - generic [ref=e147]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e148]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e149]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e150]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e151]:
        - generic [ref=e152]:
          - generic [ref=e153]: 導航
          - generic [ref=e154]:
            - link "預訂" [ref=e155]:
              - /url: /book
            - link "場地" [ref=e156]:
              - /url: /venue
            - link "關於" [ref=e157]:
              - /url: /about
            - link "博客" [ref=e158]:
              - /url: /blog
            - link "會員" [ref=e159]:
              - /url: /membership
        - generic [ref=e160]:
          - generic [ref=e161]: 法律
          - generic [ref=e162]:
            - link "幫助中心" [ref=e163]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e164]:
              - /url: /legal
            - link "私隱政策" [ref=e165]:
              - /url: /privacy
      - img "Stripe" [ref=e167]
      - generic [ref=e168]:
        - paragraph [ref=e169]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e170]:
          - link "場地使用守則及條款" [ref=e171]:
            - /url: /legal
          - link "私隱政策" [ref=e172]:
            - /url: /privacy
          - link "制作團隊" [ref=e173]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e174]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - alert [ref=e177]
  - generic [ref=e180] [cursor=pointer]:
    - generic [ref=e183]: 2 errors
    - button "Hide Errors" [ref=e184]
```

# Test source

```ts
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
> 148 |       await page.mouse.wheel(0, -500)
      |                        ^ Error: mouse.wheel: Mouse wheel is not supported in mobile WebKit
  149 |       await page.waitForTimeout(300)
  150 | 
  151 |       const backInHero = await page.evaluate(() => window.scrollY)
  152 |       expect(backInHero).toBeLessThan(pastHero)
  153 |       expect(backInHero).toBeGreaterThan(0)
  154 | 
  155 |       console.log('Re-entry: past', pastHero, '→ back', backInHero)
  156 |     })
  157 | 
  158 |     test('About Hero - reloads at 0%/30%/60%/90% show correct state', async ({ page }) => {
  159 |       const positions = [
  160 |         { percent: 0, scrollY: 0 },
  161 |         { percent: 30, scrollY: 1500 },
  162 |         { percent: 60, scrollY: 3000 },
  163 |         { percent: 90, scrollY: 4500 },
  164 |       ]
  165 | 
  166 |       for (const pos of positions) {
  167 |         await page.goto('http://localhost:3000/about')
  168 |         await page.waitForLoadState('networkidle')
  169 | 
  170 |         // Scroll to position
  171 |         await page.evaluate((y) => window.scrollTo(0, y), pos.scrollY)
  172 |         await page.waitForTimeout(500)
  173 | 
  174 |         // Reload
  175 |         await page.reload()
  176 |         await page.waitForLoadState('networkidle')
  177 |         await page.waitForTimeout(500)
  178 | 
  179 |         const afterReload = await page.evaluate(() => window.scrollY)
  180 | 
  181 |         // Should maintain scroll position (within 100px tolerance)
  182 |         expect(Math.abs(afterReload - pos.scrollY)).toBeLessThan(100)
  183 | 
  184 |         console.log(`Reload at ${pos.percent}%: expected ${pos.scrollY}, got ${afterReload}`)
  185 |       }
  186 |     })
  187 | 
  188 |     test('About Hero - NO preventDefault on wheel/touch', async ({ page }) => {
  189 |       await page.goto('http://localhost:3000/about')
  190 |       await page.waitForLoadState('networkidle')
  191 | 
  192 |       const listeners = await page.evaluate(() => {
  193 |         const results: any[] = []
  194 | 
  195 |         // Check for non-passive listeners
  196 |         const originalAddEventListener = EventTarget.prototype.addEventListener
  197 |         let nonPassiveCount = 0
  198 | 
  199 |         EventTarget.prototype.addEventListener = function(type, listener, options) {
  200 |           if (['wheel', 'touchstart', 'touchmove', 'touchend'].includes(type)) {
  201 |             const passive = typeof options === 'object' ? options.passive : true
  202 |             if (!passive) {
  203 |               nonPassiveCount++
  204 |               results.push({ type, passive: false })
  205 |             }
  206 |           }
  207 |           return originalAddEventListener.call(this, type, listener, options)
  208 |         }
  209 | 
  210 |         return { nonPassiveCount, results }
  211 |       })
  212 | 
  213 |       expect(listeners.nonPassiveCount).toBe(0)
  214 |       console.log('Non-passive listeners:', listeners)
  215 |     })
  216 | 
  217 |     test('About Hero - total scroll distance and final turn', async ({ page }) => {
  218 |       await page.goto('http://localhost:3000/about')
  219 |       await page.waitForLoadState('networkidle')
  220 | 
  221 |       // Get hero wrapper dimensions
  222 |       const heroDimensions = await page.evaluate(() => {
  223 |         const runway = document.querySelector('[data-testid="space-wheel-runway"]') as HTMLElement
  224 |         if (!runway) return null
  225 | 
  226 |         return {
  227 |           height: runway.offsetHeight,
  228 |           viewportHeight: window.innerHeight,
  229 |           viewportHeights: runway.offsetHeight / window.innerHeight,
  230 |         }
  231 |       })
  232 | 
  233 |       if (!heroDimensions) {
  234 |         console.log('Could not find hero runway element')
  235 |         return
  236 |       }
  237 | 
  238 |       console.log('Hero scroll distance:')
  239 |       console.log('- Total height:', heroDimensions.height, 'px')
  240 |       console.log('- Viewport heights:', heroDimensions.viewportHeights.toFixed(1), 'vh')
  241 | 
  242 |       // Scroll to bottom of hero
  243 |       await page.evaluate((h) => window.scrollTo(0, h + 500), heroDimensions.height)
  244 |       await page.waitForTimeout(500)
  245 | 
  246 |       const finalScrollY = await page.evaluate(() => window.scrollY)
  247 |       console.log('- Final scroll position:', finalScrollY, 'px')
  248 |     })
```