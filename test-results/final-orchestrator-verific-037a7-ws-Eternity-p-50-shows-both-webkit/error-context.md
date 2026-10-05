# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-orchestrator-verification.spec.ts >> Final Orchestrator Verification >> Room Viewer Compare >> Visual accuracy - p=100 shows Infinity, p=0 shows Eternity, p=50 shows both
- Location: tests/final-orchestrator-verification.spec.ts:320:9

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
      - generic [ref=e16]:
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
      - generic [ref=e18]:
        - heading "兩間 1T 獨立球室" [level=2] [ref=e19]
        - generic [ref=e20]:
          - tablist "房間特色" [ref=e21]:
            - tab [selected] [ref=e22] [cursor=pointer]:
              - generic [ref=e24]:
                - heading "場地裝修" [level=3] [ref=e26]
                - paragraph [ref=e27]: 特調燈光和氛圍
                - slider "拖動以比較兩間球室" [ref=e30]: ‹ ›
            - tab "舒適自在" [ref=e31] [cursor=pointer]
            - tab "專業設備" [ref=e38] [cursor=pointer]
            - tab "科技體驗" [ref=e45] [cursor=pointer]
          - tabpanel [ref=e52]:
            - generic [ref=e53]:
              - img "Space Infinity・無限空間球室・Room 1" [ref=e55]
              - img "Space Eternity・永恆空間球室・Room 2" [ref=e57]
              - slider "拖動以比較兩間球室" [ref=e59]: ‹ ›
              - button "Space Infinity・無限空間球室・Room 1" [ref=e60] [cursor=pointer]
              - button "Space Eternity・永恆空間球室・Room 2" [ref=e61] [cursor=pointer]
      - generic [ref=e64]:
        - heading "為何選擇 SPACE8" [level=2] [ref=e65]
        - generic [ref=e66]:
          - paragraph [ref=e71]:
            - generic [ref=e72]: 網上預訂，
            - generic [ref=e73]: 自助入場。
          - paragraph [ref=e80]:
            - generic [ref=e81]: 全面禁煙，
            - generic [ref=e82]: 定期清潔。
          - paragraph [ref=e91]:
            - generic [ref=e92]: 零打擾，
            - generic [ref=e93]: 全專註。
      - generic [ref=e95]:
        - heading "透明定價" [level=2] [ref=e96]
        - paragraph [ref=e97]: 按需預訂，無隱藏費用。
        - generic [ref=e98]:
          - generic [ref=e99]:
            - paragraph [ref=e100]: 每日 06:00–12:00
            - heading "上午時段" [level=3] [ref=e101]
            - generic [ref=e102]:
              - generic [ref=e103]: HK$88
              - text: / 小時
            - link "立即預訂" [ref=e104] [cursor=pointer]:
              - /url: /book
          - generic [ref=e105]:
            - paragraph [ref=e106]: 每日 12:00–18:00
            - heading "下午時段" [level=3] [ref=e107]
            - generic [ref=e108]:
              - generic [ref=e109]: HK$98
              - text: / 小時
            - link "立即預訂" [ref=e110] [cursor=pointer]:
              - /url: /book
          - generic [ref=e111]:
            - paragraph [ref=e112]: 每日 18:00–00:00
            - heading "黃金時段" [level=3] [ref=e113]
            - generic [ref=e114]:
              - generic [ref=e115]: HK$108
              - text: / 小時
            - link "立即預訂" [ref=e116] [cursor=pointer]:
              - /url: /book
      - generic [ref=e118]:
        - heading "服務說明" [level=2] [ref=e119]
        - generic [ref=e120]:
          - generic [ref=e121]:
            - generic [ref=e122]: STEP 01
            - heading "選擇時段" [level=3] [ref=e123]
            - paragraph [ref=e124]: 於網站選擇日期、時段及時長。即時確認，無需等候。
          - generic [ref=e125]:
            - generic [ref=e126]: STEP 02
            - heading "當天確認，輕鬆現結" [level=3] [ref=e127]
            - paragraph [ref=e128]: 於網站選擇日期及時段，以 Apple Pay、Google Pay 或信用卡即時付款。
          - generic [ref=e129]:
            - generic [ref=e130]: STEP 03
            - heading "掃碼入場" [level=3] [ref=e131]
            - paragraph [ref=e132]: 預訂確認後即獲 QR 碼。到場掃描，自動開門。
          - generic [ref=e133]:
            - generic [ref=e134]: 客戶支援
            - heading "客戶支援" [level=3] [ref=e135]
            - paragraph [ref=e136]: 有任何疑問，WhatsApp 聯絡我們，即時解答。
      - generic [ref=e138]:
        - heading "留意事項" [level=2] [ref=e139]
        - list [ref=e140]:
          - listitem [ref=e141]:
            - generic [ref=e142]: "1"
            - paragraph [ref=e143]: 每間球室使用人數上限為 8 人。
          - listitem [ref=e144]:
            - generic [ref=e145]: "2"
            - paragraph [ref=e146]: 本場內、大廈走廊及後樓梯亦全面禁煙，包括電子煙及加熱煙。
          - listitem [ref=e147]:
            - generic [ref=e148]: "3"
            - paragraph [ref=e149]: 未滿 12 歲人士須由年滿 18 歲成人全程陪同。
          - listitem [ref=e150]:
            - generic [ref=e151]: "4"
            - paragraph [ref=e152]: 請於預約時段結束時準時離場，超時 15 分鐘將收取超時費用。
          - listitem [ref=e153]:
            - generic [ref=e154]: "5"
            - paragraph [ref=e155]: 離場請配合：球具歸位（桌球入器，球桿上架）、清潔檯面，帶走垃圾、隨手關冷氣（燈光為自動感應）。感謝您的配合，共同維護優質環境！
          - listitem [ref=e156]:
            - generic [ref=e157]: "6"
            - paragraph [ref=e158]: 進場後如發現設施損壞，請盡快通過 WhatsApp 向我們報告。
        - link "查看完整場地使用守則及條款" [ref=e159]:
          - /url: https://space8.com.hk/legal
      - generic [ref=e162]:
        - heading "惡劣天氣及特殊安排" [level=2] [ref=e167]
        - generic [ref=e168]:
          - generic [ref=e169]:
            - paragraph [ref=e170]: 【8 號或以上風球 / 黑色暴雨警告】
            - list [ref=e171]:
              - listitem [ref=e172]: 如常營業：場地自動化系統維持正常運作，閣下可評估安全後如常前往。
              - listitem [ref=e173]: 改期機制：若決定不前往，必須於原預約時間開始前以 WhatsApp 聯繫客服，即可安排於 7 天內免費改期（不設退款）。
              - listitem [ref=e174]: 逾期處理：超過預約時間才申請或未於 7 天內使用，將視為自動放棄權益。
          - generic [ref=e175]:
            - paragraph [ref=e176]: 【一般情況 / 其它天氣（如 3 號風球、紅雨）】
            - list [ref=e177]:
              - listitem [ref=e178]: 不設退改：除上述極端天氣守則外，所有預約一經確認，一律不接受取消、改期或退款。
        - link "查看完整場地使用守則及條款" [ref=e179]:
          - /url: https://space8.com.hk/legal
      - generic [ref=e182]:
        - generic [ref=e183]:
          - heading "如何前往" [level=2] [ref=e189]
          - paragraph [ref=e190]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
          - list [ref=e191]:
            - listitem [ref=e192]: 港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
            - listitem [ref=e193]: 距離鑽石山站 A2 出口 500 米（建議路線）
            - listitem [ref=e194]: 亦可乘搭巴士或小巴至大有街附近下車
            - listitem [ref=e195]: 建議泊車：新科技廣場停車場（威信停車場）
          - generic [ref=e196]:
            - link "Google Maps 導航" [ref=e197] [cursor=pointer]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - link "立即預訂" [ref=e201] [cursor=pointer]:
              - /url: /book
        - iframe [ref=e203]
    - generic [ref=e205]:
      - generic [ref=e206]:
        - img "Space8" [ref=e207]
        - generic [ref=e208]:
          - link "WhatsApp" [ref=e209]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e212]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e216]:
        - generic [ref=e217]:
          - generic [ref=e218]: 聯繫我們
          - link "Google Maps 導航" [ref=e220]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e221]:
              - button "Marker" [ref=e222] [cursor=pointer]
              - generic [ref=e223]:
                - link "Leaflet" [ref=e224]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e229]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e230]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e237]:
            - generic [ref=e238]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e239]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e240]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e241]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e251]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e257]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e258]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e259]
          - generic [ref=e260]:
            - generic [ref=e261]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e262]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e263]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e264]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e265]:
        - generic [ref=e266]:
          - generic [ref=e267]: 導航
          - generic [ref=e268]:
            - link "預訂" [ref=e269]:
              - /url: /book
            - link "場地" [ref=e270]:
              - /url: /venue
            - link "關於" [ref=e271]:
              - /url: /about
            - link "博客" [ref=e272]:
              - /url: /blog
            - link "會員" [ref=e273]:
              - /url: /membership
        - generic [ref=e274]:
          - generic [ref=e275]: 法律
          - generic [ref=e276]:
            - link "幫助中心" [ref=e277]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e278]:
              - /url: /legal
            - link "私隱政策" [ref=e279]:
              - /url: /privacy
      - img "Stripe" [ref=e281]
      - generic [ref=e282]:
        - paragraph [ref=e283]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e284]:
          - link "場地使用守則及條款" [ref=e285]:
            - /url: /legal
          - link "私隱政策" [ref=e286]:
            - /url: /privacy
          - link "制作團隊" [ref=e287]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e288]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - generic [ref=e293]:
    - heading "為何選擇 SPACE8" [level=2] [ref=e294]
    - generic [ref=e295]:
      - paragraph [ref=e300]:
        - generic [ref=e301]: 網上預訂，
        - generic [ref=e302]: 自助入場。
      - paragraph [ref=e309]:
        - generic [ref=e310]: 全面禁煙，
        - generic [ref=e311]: 定期清潔。
      - paragraph [ref=e320]:
        - generic [ref=e321]: 零打擾，
        - generic [ref=e322]: 全專註。
  - generic [ref=e324]:
    - heading "服務說明" [level=2] [ref=e325]
    - generic [ref=e326]:
      - generic [ref=e327]:
        - generic [ref=e328]: STEP 01
        - heading "選擇時段" [level=3] [ref=e329]
        - paragraph [ref=e330]: 於網站選擇日期、時段及時長。即時確認，無需等候。
      - generic [ref=e331]:
        - generic [ref=e332]: STEP 02
        - heading "當天確認，輕鬆現結" [level=3] [ref=e333]
        - paragraph [ref=e334]: 於網站選擇日期及時段，以 Apple Pay、Google Pay 或信用卡即時付款。
      - generic [ref=e335]:
        - generic [ref=e336]: STEP 03
        - heading "掃碼入場" [level=3] [ref=e337]
        - paragraph [ref=e338]: 預訂確認後即獲 QR 碼。到場掃描，自動開門。
      - generic [ref=e339]:
        - generic [ref=e340]: 客戶支援
        - heading "客戶支援" [level=3] [ref=e341]
        - paragraph [ref=e342]: 有任何疑問，WhatsApp 聯絡我們，即時解答。
  - generic [ref=e344]:
    - heading "留意事項" [level=2] [ref=e345]
    - list [ref=e346]:
      - listitem [ref=e347]:
        - generic [ref=e348]: "1"
        - paragraph [ref=e349]: 每間球室使用人數上限為 8 人。
      - listitem [ref=e350]:
        - generic [ref=e351]: "2"
        - paragraph [ref=e352]: 本場內、大廈走廊及後樓梯亦全面禁煙，包括電子煙及加熱煙。
      - listitem [ref=e353]:
        - generic [ref=e354]: "3"
        - paragraph [ref=e355]: 未滿 12 歲人士須由年滿 18 歲成人全程陪同。
      - listitem [ref=e356]:
        - generic [ref=e357]: "4"
        - paragraph [ref=e358]: 請於預約時段結束時準時離場，超時 15 分鐘將收取超時費用。
      - listitem [ref=e359]:
        - generic [ref=e360]: "5"
        - paragraph [ref=e361]: 離場請配合：球具歸位（桌球入器，球桿上架）、清潔檯面，帶走垃圾、隨手關冷氣（燈光為自動感應）。感謝您的配合，共同維護優質環境！
      - listitem [ref=e362]:
        - generic [ref=e363]: "6"
        - paragraph [ref=e364]: 進場後如發現設施損壞，請盡快通過 WhatsApp 向我們報告。
    - link "查看完整場地使用守則及條款" [ref=e365]:
      - /url: https://space8.com.hk/legal
  - generic [ref=e368]:
    - heading "惡劣天氣及特殊安排" [level=2] [ref=e373]
    - generic [ref=e374]:
      - generic [ref=e375]:
        - paragraph [ref=e376]: 【8 號或以上風球 / 黑色暴雨警告】
        - list [ref=e377]:
          - listitem [ref=e378]: 如常營業：場地自動化系統維持正常運作，閣下可評估安全後如常前往。
          - listitem [ref=e379]: 改期機制：若決定不前往，必須於原預約時間開始前以 WhatsApp 聯繫客服，即可安排於 7 天內免費改期（不設退款）。
          - listitem [ref=e380]: 逾期處理：超過預約時間才申請或未於 7 天內使用，將視為自動放棄權益。
      - generic [ref=e381]:
        - paragraph [ref=e382]: 【一般情況 / 其它天氣（如 3 號風球、紅雨）】
        - list [ref=e383]:
          - listitem [ref=e384]: 不設退改：除上述極端天氣守則外，所有預約一經確認，一律不接受取消、改期或退款。
    - link "查看完整場地使用守則及條款" [ref=e385]:
      - /url: https://space8.com.hk/legal
  - generic [ref=e388]:
    - generic [ref=e389]:
      - heading "如何前往" [level=2] [ref=e395]
      - paragraph [ref=e396]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
      - list [ref=e397]:
        - listitem [ref=e398]: 港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
        - listitem [ref=e399]: 距離鑽石山站 A2 出口 500 米（建議路線）
        - listitem [ref=e400]: 亦可乘搭巴士或小巴至大有街附近下車
        - listitem [ref=e401]: 建議泊車：新科技廣場停車場（威信停車場）
      - generic [ref=e402]:
        - link "Google Maps 導航" [ref=e403] [cursor=pointer]:
          - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
        - link "立即預訂" [ref=e407] [cursor=pointer]:
          - /url: /book
    - iframe [ref=e409]
  - contentinfo [ref=e410]:
    - generic [ref=e411]:
      - generic [ref=e412]:
        - img "Space8" [ref=e413]
        - generic [ref=e414]:
          - link "WhatsApp" [ref=e415]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e418]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e422]:
        - generic [ref=e423]:
          - generic [ref=e424]: 聯繫我們
          - generic [ref=e432]:
            - generic [ref=e433]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e434]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e435]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e436]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e446]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e452]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e453]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e454]
          - generic [ref=e455]:
            - generic [ref=e456]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，
            - generic [ref=e457]: 兩間1T獨立球室，每日 06:00 至 24:00 營業。
            - generic [ref=e458]: 網上預訂、二維碼自助入場。專業設備，智能系統，聚光在桌球本身。
            - generic [ref=e459]: 鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e460]:
        - generic [ref=e461]:
          - generic [ref=e462]: 導航
          - generic [ref=e463]:
            - link "預訂" [ref=e464]:
              - /url: /book
            - link "場地" [ref=e465]:
              - /url: /venue
            - link "關於" [ref=e466]:
              - /url: /about
            - link "博客" [ref=e467]:
              - /url: /blog
            - link "會員" [ref=e468]:
              - /url: /membership
        - generic [ref=e469]:
          - generic [ref=e470]: 法律
          - generic [ref=e471]:
            - link "幫助中心" [ref=e472]:
              - /url: /help-center
            - link "場地使用守則及條款" [ref=e473]:
              - /url: /legal
            - link "私隱政策" [ref=e474]:
              - /url: /privacy
      - img "Stripe" [ref=e476]
      - generic [ref=e477]:
        - paragraph [ref=e478]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e479]:
          - link "場地使用守則及條款" [ref=e480]:
            - /url: /legal
          - link "私隱政策" [ref=e481]:
            - /url: /privacy
          - link "制作團隊" [ref=e482]:
            - /url: /credits
  - alert [ref=e483]
  - generic [ref=e486] [cursor=pointer]:
    - generic [ref=e489]: 2 errors
    - button "Hide Errors" [ref=e490]
```

# Test source

```ts
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
  283 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
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
> 332 |       await page.waitForSelector('[data-testid="room-viewer"]', { timeout: 10000 })
      |                  ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
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
```