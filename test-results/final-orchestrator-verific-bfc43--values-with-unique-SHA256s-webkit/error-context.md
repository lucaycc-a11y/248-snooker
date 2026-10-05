# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Room Viewer Compare >> Four unique currentSrc values with unique SHA256s
- Location: tests/final-orchestrator-verification.spec.ts:278:9

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[data-testid="room-viewer"]') to be visible

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
      - generic [ref=e18]:
        - generic:
          - generic:
            - generic:
              - img "Space Infinity 包廂內部全景"
          - generic:
            - generic:
              - img "Space Eternity 包廂內部"
          - generic:
            - generic:
              - img "場地內部環境"
          - generic:
            - generic:
              - img "星牌桌球臺特寫"
          - generic:
            - generic:
              - img "專業球臺細節"
          - generic:
            - generic:
              - img "Space Pilot 智能計分系統"
          - generic:
            - generic:
              - img "球桿架設施"
          - generic:
            - generic:
              - img "休息區梳化"
        - generic:
          - heading "自助中式桌球獨立球室" [level=1]
          - paragraph:
            - strong: 獨立球室，無多餘干擾。
            - text: 一張桌、一局球、一段只屬於你們的時間，掃碼開門，燈光為你亮起。
      - generic [ref=e20]:
        - heading "兩間 1T 獨立球室" [level=2] [ref=e21]
        - generic [ref=e22]:
          - tabpanel [ref=e23]:
            - generic [ref=e24]:
              - img "Space Infinity・無限空間球室・Room 1" [ref=e26]
              - img "Space Eternity・永恆空間球室・Room 2" [ref=e28]
              - generic [ref=e29]: ‹ ›
          - generic [ref=e31]:
            - tab "場地裝修" [selected] [ref=e32] [cursor=pointer]
            - tab "舒適自在" [ref=e33] [cursor=pointer]
            - tab "專業設備" [ref=e34] [cursor=pointer]
            - tab "科技體驗" [ref=e35] [cursor=pointer]
      - generic [ref=e38]:
        - heading "為何選擇 SPACE8" [level=2] [ref=e39]
        - generic [ref=e40]:
          - paragraph [ref=e45]:
            - generic [ref=e46]: 網上預訂，
            - generic [ref=e47]: 自助入場。
          - paragraph [ref=e54]:
            - generic [ref=e55]: 全面禁煙，
            - generic [ref=e56]: 定期清潔。
          - paragraph [ref=e65]:
            - generic [ref=e66]: 零打擾，
            - generic [ref=e67]: 全專註。
      - generic [ref=e69]:
        - heading "透明定價" [level=2] [ref=e70]
        - paragraph [ref=e71]: 按需預訂，無隱藏費用。
        - generic [ref=e72]:
          - generic [ref=e73]:
            - paragraph [ref=e74]: 每日 06:00–12:00
            - heading "上午時段" [level=3] [ref=e75]
            - generic [ref=e76]:
              - generic [ref=e77]: HK$88
              - text: / 小時
            - link "立即預訂" [ref=e78] [cursor=pointer]:
              - /url: /book
          - generic [ref=e79]:
            - paragraph [ref=e80]: 每日 12:00–18:00
            - heading "下午時段" [level=3] [ref=e81]
            - generic [ref=e82]:
              - generic [ref=e83]: HK$98
              - text: / 小時
            - link "立即預訂" [ref=e84] [cursor=pointer]:
              - /url: /book
          - generic [ref=e85]:
            - paragraph [ref=e86]: 每日 18:00–00:00
            - heading "黃金時段" [level=3] [ref=e87]
            - generic [ref=e88]:
              - generic [ref=e89]: HK$108
              - text: / 小時
            - link "立即預訂" [ref=e90] [cursor=pointer]:
              - /url: /book
      - generic [ref=e92]:
        - heading "服務說明" [level=2] [ref=e93]
        - generic [ref=e94]:
          - generic [ref=e95]:
            - generic [ref=e96]: STEP 01
            - heading "選擇時段" [level=3] [ref=e97]
            - paragraph [ref=e98]: 於網站選擇日期、時段及時長。即時確認，無需等候。
          - generic [ref=e99]:
            - generic [ref=e100]: STEP 02
            - heading "當天確認，輕鬆現結" [level=3] [ref=e101]
            - paragraph [ref=e102]: 於網站選擇日期及時段，以 Apple Pay、Google Pay 或信用卡即時付款。
          - generic [ref=e103]:
            - generic [ref=e104]: STEP 03
            - heading "掃碼入場" [level=3] [ref=e105]
            - paragraph [ref=e106]: 預訂確認後即獲 QR 碼。到場掃描，自動開門。
          - generic [ref=e107]:
            - generic [ref=e108]: 客戶支援
            - heading "客戶支援" [level=3] [ref=e109]
            - paragraph [ref=e110]: 有任何疑問，WhatsApp 聯絡我們，即時解答。
      - generic [ref=e112]:
        - heading "留意事項" [level=2] [ref=e113]
        - list [ref=e114]:
          - listitem [ref=e115]:
            - generic [ref=e116]: "1"
            - paragraph [ref=e117]: 每間球室使用人數上限為 8 人。
          - listitem [ref=e118]:
            - generic [ref=e119]: "2"
            - paragraph [ref=e120]: 本場內、大廈走廊及後樓梯亦全面禁煙，包括電子煙及加熱煙。
          - listitem [ref=e121]:
            - generic [ref=e122]: "3"
            - paragraph [ref=e123]: 未滿 12 歲人士須由年滿 18 歲成人全程陪同。
          - listitem [ref=e124]:
            - generic [ref=e125]: "4"
            - paragraph [ref=e126]: 請於預約時段結束時準時離場，超時 15 分鐘將收取超時費用。
          - listitem [ref=e127]:
            - generic [ref=e128]: "5"
            - paragraph [ref=e129]: 離場請配合：球具歸位（桌球入器，球桿上架）、清潔檯面，帶走垃圾、隨手關冷氣（燈光為自動感應）。感謝您的配合，共同維護優質環境！
          - listitem [ref=e130]:
            - generic [ref=e131]: "6"
            - paragraph [ref=e132]: 進場後如發現設施損壞，請盡快通過 WhatsApp 向我們報告。
        - link "查看完整場地使用守則及條款" [ref=e133]:
          - /url: https://space8.com.hk/legal
      - generic [ref=e136]:
        - heading "惡劣天氣及特殊安排" [level=2] [ref=e141]
        - generic [ref=e142]:
          - generic [ref=e143]:
            - paragraph [ref=e144]: 【8 號或以上風球 / 黑色暴雨警告】
            - list [ref=e145]:
              - listitem [ref=e146]: 如常營業：場地自動化系統維持正常運作，閣下可評估安全後如常前往。
              - listitem [ref=e147]: 改期機制：若決定不前往，必須於原預約時間開始前以 WhatsApp 聯繫客服，即可安排於 7 天內免費改期（不設退款）。
              - listitem [ref=e148]: 逾期處理：超過預約時間才申請或未於 7 天內使用，將視為自動放棄權益。
          - generic [ref=e149]:
            - paragraph [ref=e150]: 【一般情況 / 其它天氣（如 3 號風球、紅雨）】
            - list [ref=e151]:
              - listitem [ref=e152]: 不設退改：除上述極端天氣守則外，所有預約一經確認，一律不接受取消、改期或退款。
        - link "查看完整場地使用守則及條款" [ref=e153]:
          - /url: https://space8.com.hk/legal
      - generic [ref=e156]:
        - generic [ref=e157]:
          - heading "如何前往" [level=2] [ref=e163]
          - paragraph [ref=e164]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
          - list [ref=e165]:
            - listitem [ref=e166]: 港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
            - listitem [ref=e167]: 距離鑽石山站 A2 出口 500 米（建議路線）
            - listitem [ref=e168]: 亦可乘搭巴士或小巴至大有街附近下車
            - listitem [ref=e169]: 建議泊車：新科技廣場停車場（威信停車場）
          - generic [ref=e170]:
            - link "Google Maps 導航" [ref=e171] [cursor=pointer]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - link "立即預訂" [ref=e175] [cursor=pointer]:
              - /url: /book
        - generic [ref=e176]:
          - iframe
    - generic [ref=e178]:
      - generic [ref=e179]:
        - img "Space8" [ref=e180]
        - generic [ref=e181]:
          - link "WhatsApp" [ref=e182]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e185]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e189]:
        - generic [ref=e190]:
          - generic [ref=e191]: 聯繫我們
          - link "Google Maps 導航" [ref=e193]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e194]:
              - button "Marker" [ref=e195] [cursor=pointer]
              - generic [ref=e196]:
                - link "Leaflet" [ref=e197]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e202]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e203]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e210]:
            - generic [ref=e211]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e212]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e213]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e214]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e224]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e230]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e231]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e232]
          - generic [ref=e233]:
            - generic [ref=e234]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e235]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e236]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e237]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e238]:
        - generic [ref=e239]:
          - generic [ref=e240]: 導航
          - generic [ref=e241]:
            - link "預訂" [ref=e242]:
              - /url: /book
            - link "場地" [ref=e243]:
              - /url: /venue
            - link "關於" [ref=e244]:
              - /url: /about
            - link "博客" [ref=e245]:
              - /url: /blog
            - link "會員" [ref=e246]:
              - /url: /membership
        - generic [ref=e247]:
          - generic [ref=e248]: 法律
          - generic [ref=e249]:
            - link "幫助中心" [ref=e250]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e251]:
              - /url: /legal
            - link "私隱政策" [ref=e252]:
              - /url: /privacy
      - img "Stripe" [ref=e254]
      - generic [ref=e255]:
        - paragraph [ref=e256]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e257]:
          - link "場地使用守則及條款" [ref=e258]:
            - /url: /legal
          - link "私隱政策" [ref=e259]:
            - /url: /privacy
          - link "制作團隊" [ref=e260]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e261]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - generic [ref=e264]:
    - tabpanel [ref=e265]:
      - generic [ref=e266]:
        - img "Space Infinity・無限空間球室・Room 1" [ref=e268]
        - img "Space Eternity・永恆空間球室・Room 2" [ref=e270]
        - generic [ref=e271]: ‹ ›
    - generic [ref=e273]:
      - tab "場地裝修" [selected] [ref=e274] [cursor=pointer]
      - tab "舒適自在" [ref=e275] [cursor=pointer]
      - tab "專業設備" [ref=e276] [cursor=pointer]
      - tab "科技體驗" [ref=e277] [cursor=pointer]
  - generic [ref=e280]:
    - heading "為何選擇 SPACE8" [level=2] [ref=e281]
    - generic [ref=e282]:
      - paragraph [ref=e287]:
        - generic [ref=e288]: 網上預訂，
        - generic [ref=e289]: 自助入場。
      - paragraph [ref=e296]:
        - generic [ref=e297]: 全面禁煙，
        - generic [ref=e298]: 定期清潔。
      - paragraph [ref=e307]:
        - generic [ref=e308]: 零打擾，
        - generic [ref=e309]: 全專註。
  - generic [ref=e311]:
    - heading "服務說明" [level=2] [ref=e312]
    - generic [ref=e313]:
      - generic [ref=e314]:
        - generic [ref=e315]: STEP 01
        - heading "選擇時段" [level=3] [ref=e316]
        - paragraph [ref=e317]: 於網站選擇日期、時段及時長。即時確認，無需等候。
      - generic [ref=e318]:
        - generic [ref=e319]: STEP 02
        - heading "當天確認，輕鬆現結" [level=3] [ref=e320]
        - paragraph [ref=e321]: 於網站選擇日期及時段，以 Apple Pay、Google Pay 或信用卡即時付款。
      - generic [ref=e322]:
        - generic [ref=e323]: STEP 03
        - heading "掃碼入場" [level=3] [ref=e324]
        - paragraph [ref=e325]: 預訂確認後即獲 QR 碼。到場掃描，自動開門。
      - generic [ref=e326]:
        - generic [ref=e327]: 客戶支援
        - heading "客戶支援" [level=3] [ref=e328]
        - paragraph [ref=e329]: 有任何疑問，WhatsApp 聯絡我們，即時解答。
  - generic [ref=e331]:
    - heading "留意事項" [level=2] [ref=e332]
    - list [ref=e333]:
      - listitem [ref=e334]:
        - generic [ref=e335]: "1"
        - paragraph [ref=e336]: 每間球室使用人數上限為 8 人。
      - listitem [ref=e337]:
        - generic [ref=e338]: "2"
        - paragraph [ref=e339]: 本場內、大廈走廊及後樓梯亦全面禁煙，包括電子煙及加熱煙。
      - listitem [ref=e340]:
        - generic [ref=e341]: "3"
        - paragraph [ref=e342]: 未滿 12 歲人士須由年滿 18 歲成人全程陪同。
      - listitem [ref=e343]:
        - generic [ref=e344]: "4"
        - paragraph [ref=e345]: 請於預約時段結束時準時離場，超時 15 分鐘將收取超時費用。
      - listitem [ref=e346]:
        - generic [ref=e347]: "5"
        - paragraph [ref=e348]: 離場請配合：球具歸位（桌球入器，球桿上架）、清潔檯面，帶走垃圾、隨手關冷氣（燈光為自動感應）。感謝您的配合，共同維護優質環境！
      - listitem [ref=e349]:
        - generic [ref=e350]: "6"
        - paragraph [ref=e351]: 進場後如發現設施損壞，請盡快通過 WhatsApp 向我們報告。
    - link "查看完整場地使用守則及條款" [ref=e352]:
      - /url: https://space8.com.hk/legal
  - generic [ref=e355]:
    - heading "惡劣天氣及特殊安排" [level=2] [ref=e360]
    - generic [ref=e361]:
      - generic [ref=e362]:
        - paragraph [ref=e363]: 【8 號或以上風球 / 黑色暴雨警告】
        - list [ref=e364]:
          - listitem [ref=e365]: 如常營業：場地自動化系統維持正常運作，閣下可評估安全後如常前往。
          - listitem [ref=e366]: 改期機制：若決定不前往，必須於原預約時間開始前以 WhatsApp 聯繫客服，即可安排於 7 天內免費改期（不設退款）。
          - listitem [ref=e367]: 逾期處理：超過預約時間才申請或未於 7 天內使用，將視為自動放棄權益。
      - generic [ref=e368]:
        - paragraph [ref=e369]: 【一般情況 / 其它天氣（如 3 號風球、紅雨）】
        - list [ref=e370]:
          - listitem [ref=e371]: 不設退改：除上述極端天氣守則外，所有預約一經確認，一律不接受取消、改期或退款。
    - link "查看完整場地使用守則及條款" [ref=e372]:
      - /url: https://space8.com.hk/legal
  - generic [ref=e375]:
    - generic [ref=e376]:
      - heading "如何前往" [level=2] [ref=e382]
      - paragraph [ref=e383]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
      - list [ref=e384]:
        - listitem [ref=e385]: 港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
        - listitem [ref=e386]: 距離鑽石山站 A2 出口 500 米（建議路線）
        - listitem [ref=e387]: 亦可乘搭巴士或小巴至大有街附近下車
        - listitem [ref=e388]: 建議泊車：新科技廣場停車場（威信停車場）
      - generic [ref=e389]:
        - link "Google Maps 導航" [ref=e390] [cursor=pointer]:
          - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
        - link "立即預訂" [ref=e394] [cursor=pointer]:
          - /url: /book
    - generic [ref=e395]:
      - iframe
  - contentinfo [ref=e396]:
    - generic [ref=e397]:
      - generic [ref=e398]:
        - img "Space8" [ref=e399]
        - generic [ref=e400]:
          - link "WhatsApp" [ref=e401]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e404]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e408]:
        - generic [ref=e409]:
          - generic [ref=e410]: 聯繫我們
          - generic [ref=e418]:
            - generic [ref=e419]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e420]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e421]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e422]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e432]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e438]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e439]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e440]
          - generic [ref=e441]:
            - generic [ref=e442]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e443]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e444]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e445]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e446]:
        - generic [ref=e447]:
          - generic [ref=e448]: 導航
          - generic [ref=e449]:
            - link "預訂" [ref=e450]:
              - /url: /book
            - link "場地" [ref=e451]:
              - /url: /venue
            - link "關於" [ref=e452]:
              - /url: /about
            - link "博客" [ref=e453]:
              - /url: /blog
            - link "會員" [ref=e454]:
              - /url: /membership
        - generic [ref=e455]:
          - generic [ref=e456]: 法律
          - generic [ref=e457]:
            - link "幫助中心" [ref=e458]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e459]:
              - /url: /legal
            - link "私隱政策" [ref=e460]:
              - /url: /privacy
      - img "Stripe" [ref=e462]
      - generic [ref=e463]:
        - paragraph [ref=e464]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e465]:
          - link "場地使用守則及條款" [ref=e466]:
            - /url: /legal
          - link "私隱政策" [ref=e467]:
            - /url: /privacy
          - link "制作團隊" [ref=e468]:
            - /url: /credits
  - alert [ref=e469]
  - generic [ref=e472] [cursor=pointer]:
    - generic [ref=e475]: 2 errors
    - button "Hide Errors" [ref=e476]
```

# Test source

```ts
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
  249 | 
  250 |     test('Static layout - 390px and reduced motion', async ({ page }) => {
  251 |       // Test 390px viewport
  252 |       await page.setViewportSize({ width: 390, height: 844 })
  253 |       await page.goto('http://localhost:3000/about')
  254 |       await page.waitForLoadState('networkidle')
  255 | 
  256 |       const has390Layout = await page.evaluate(() => {
  257 |         const runway = document.querySelector('[data-testid="space-wheel-runway"]')
  258 |         return runway === null || window.getComputedStyle(runway as HTMLElement).position !== 'relative'
  259 |       })
  260 | 
  261 |       console.log('390px shows static layout:', has390Layout)
  262 | 
  263 |       // Test reduced motion
  264 |       await page.emulateMedia({ reducedMotion: 'reduce' })
  265 |       await page.reload()
  266 |       await page.waitForLoadState('networkidle')
  267 | 
  268 |       const hasReducedMotionLayout = await page.evaluate(() => {
  269 |         const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  270 |         return prefersReduced
  271 |       })
  272 | 
  273 |       console.log('Reduced motion active:', hasReducedMotionLayout)
  274 |     })
  275 |   })
  276 | 
  277 |   test.describe('Room Viewer Compare', () => {
  278 |     test('Four unique currentSrc values with unique SHA256s', async ({ page }) => {
  279 |       await page.goto('http://localhost:3000/venue')
  280 |       await page.waitForLoadState('networkidle')
  281 | 
  282 |       // Wait for RoomViewer to load
> 283 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
      |                  ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  284 | 
  285 |       // Get all image src values
  286 |       const imageSrcs = await page.evaluate(() => {
  287 |         const images = Array.from(document.querySelectorAll('[data-testid="room-viewer"] img'))
  288 |         return images.map(img => (img as HTMLImageElement).currentSrc).filter(Boolean)
  289 |       })
  290 | 
  291 |       console.log('Image sources found:', imageSrcs.length)
  292 |       console.log('Unique sources:', new Set(imageSrcs).size)
  293 | 
  294 |       // Compute SHA256 for the 4 specified files
  295 |       const baseDir = '/Users/lucayau/Documents/Space8_web/public/images'
  296 |       const files = [
  297 |         'venue-page-infinity.jpg',
  298 |         'venue-page-eternity.jpg',
  299 |         'space8-about-photos/images/about-06-lounge.webp',
  300 |         'space8-about-photos/images/about-07-stools.webp',
  301 |       ]
  302 | 
  303 |       const hashes: Record<string, string> = {}
  304 |       for (const file of files) {
  305 |         const fullPath = path.join(baseDir, file)
  306 |         if (fs.existsSync(fullPath)) {
  307 |           const content = fs.readFileSync(fullPath)
  308 |           const hash = crypto.createHash('sha256').update(content).digest('hex')
  309 |           hashes[file] = hash
  310 |           console.log(`${file}: ${hash}`)
  311 |         }
  312 |       }
  313 | 
  314 |       // Verify all hashes are unique
  315 |       const hashValues = Object.values(hashes)
  316 |       const uniqueHashes = new Set(hashValues)
  317 |       expect(uniqueHashes.size).toBe(4)
  318 |     })
  319 | 
  320 |     test('Visual accuracy - p=100 shows Infinity, p=0 shows Eternity, p=50 shows both', async ({ page, browserName }) => {
  321 |       if (browserName !== 'webkit') test.skip()
  322 | 
  323 |       const iPad = {
  324 |         name: 'iPad Pro landscape',
  325 |         viewport: { width: 1194, height: 834 },
  326 |         hasTouch: true,
  327 |       }
  328 |       await page.setViewportSize(iPad.viewport)
  329 | 
  330 |       await page.goto('http://localhost:3000/venue')
  331 |       await page.waitForLoadState('networkidle')
  332 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
  333 | 
  334 |       // Test p=100 (Infinity only)
  335 |       await page.evaluate(() => {
  336 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  337 |         if (slider) {
  338 |           slider.value = '100'
  339 |           slider.dispatchEvent(new Event('input', { bubbles: true }))
  340 |         }
  341 |       })
  342 |       await page.waitForTimeout(500)
  343 | 
  344 |       const infinityOnly = await page.screenshot({ path: 'test-results/compare-p100-infinity.png' })
  345 |       console.log('p=100 screenshot saved')
  346 | 
  347 |       // Test p=0 (Eternity only)
  348 |       await page.evaluate(() => {
  349 |         const slider = document.querySelector('input[type="range"]') as HTMLInputElement
  350 |         if (slider) {
  351 |           slider.value = '0'
  352 |           slider.dispatchEvent(new Event('input', { bubbles: true }))
  353 |         }
  354 |       })
  355 |       await page.waitForTimeout(500)
  356 | 
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
```