# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: find-carousel.spec.ts >> Find carousel on page
- Location: tests/find-carousel.spec.ts:3:5

# Error details

```
Error: Channel closed
```

```
Error: page.waitForTimeout: Test ended.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - navigation:
      - link "主頁" [ref=e3] [cursor=pointer]:
        - /url: /
        - img "Space8" [ref=e4]
      - generic [ref=e5]:
        - link "主頁" [ref=e6] [cursor=pointer]:
          - /url: /
        - link "預訂" [ref=e7] [cursor=pointer]:
          - /url: /book
        - link "場地" [ref=e8] [cursor=pointer]:
          - /url: /venue
        - link "關於" [ref=e9] [cursor=pointer]:
          - /url: /about
        - link "博客" [ref=e10] [cursor=pointer]:
          - /url: /blog
        - link "會員" [ref=e11] [cursor=pointer]:
          - /url: /membership
        - button "Switch language" [ref=e13] [cursor=pointer]: 繁
      - button "登入" [ref=e14] [cursor=pointer]
    - generic [ref=e16]:
      - generic:
        - img "SPACE8 香港自助中式桌球會所 專業球枱設施"
      - generic:
        - generic:
          - generic:
            - img "Space8"
          - generic:
            - heading "屬於你的主場" [level=1]
          - generic:
            - paragraph: 自助無煙智能中式桌球室，無多餘干擾。
          - generic [ref=e18]:
            - link "立即預訂" [ref=e19] [cursor=pointer]:
              - /url: /book
            - link "了解更多" [ref=e20] [cursor=pointer]:
              - /url: /venue
    - region [ref=e21]:
      - generic [ref=e23]:
        - heading "每個細節，都讓你專注於桌球。" [level=2] [ref=e24]
        - paragraph [ref=e25]:
          - generic [ref=e26]: 專業設備、智能系統
          - text: ，
          - generic [ref=e27]: 聚光在桌球本身。
      - generic [ref=e28]:
        - region "Carousel" [ref=e29]:
          - tabpanel [ref=e30]:
            - img "精選星牌桌球臺" [ref=e31]
            - generic [ref=e32]:
              - generic [ref=e33]: 設備
              - heading "精選星牌桌球臺" [level=3] [ref=e34]
            - button "查看詳情" [ref=e35] [cursor=pointer]
          - tabpanel [ref=e37]:
            - img "特別裝修，特調燈光和氛圍" [ref=e38]
            - generic [ref=e39]:
              - generic [ref=e40]: 氛圍
              - heading "特別裝修，特調燈光和氛圍" [level=3] [ref=e41]
            - button "查看詳情" [ref=e42] [cursor=pointer]
          - tabpanel [ref=e44]:
            - img "引入 AI 智能對戰管家" [ref=e45]
            - generic: 敬請期待
            - generic [ref=e46]:
              - generic [ref=e47]: 智能系統
              - heading "引入 AI 智能對戰管家" [level=3] [ref=e48]
            - button "查看詳情" [ref=e49] [cursor=pointer]
          - tabpanel [ref=e51]:
            - img "自助入場，乾淨無煙區域" [ref=e52]
            - generic [ref=e53]:
              - generic [ref=e54]: 入場
              - heading "自助入場，乾淨無煙區域" [level=3] [ref=e55]
            - button "查看詳情" [ref=e56] [cursor=pointer]
        - generic [ref=e58]:
          - tab "Go to slide 1" [selected]
          - tab "Go to slide 2"
          - tab "Go to slide 3"
          - tab "Go to slide 4"
          - button "Pause carousel" [pressed] [ref=e59] [cursor=pointer]
    - region [ref=e63]:
      - generic [ref=e65]:
        - paragraph [ref=e66]: Space Pilot
        - heading "將科技融入桌球" [level=2] [ref=e67]
        - img "SPACE8 Space Pilot 即時比分板，展示比賽比分、勝場統計、球員排名及剩餘時段" [ref=e70]
        - generic [ref=e71]:
          - generic [ref=e72]:
            - paragraph [ref=e73]: Space Pilot 智能管家
            - paragraph [ref=e74]: 敬請期待
            - paragraph [ref=e75]: 功能開發中，詳情將於日後公佈
          - generic [ref=e76]:
            - text: Space Pilot 將私人球室變成即時賽事中樞
            - strong [ref=e77]: ：比分、勝場、排名和剩餘時間清晰呈現，
            - text: 讓你專注於球臺
            - strong [ref=e78]: 。
    - region [ref=e79]:
      - heading "如何使用" [level=2] [ref=e80]
      - generic [ref=e87]:
        - button "01 選擇時段 選擇日期、時間及時長。即時確認，無需等候。 立即預訂" [ref=e88]:
          - generic [ref=e89]: "01"
          - generic [ref=e90]:
            - heading "選擇時段" [level=3] [ref=e91]
            - paragraph [ref=e92]: 選擇日期、時間及時長。即時確認，無需等候。
            - link "立即預訂" [ref=e93] [cursor=pointer]:
              - /url: /book
        - button "02 掃碼入場 預訂確認後即獲 QR 碼。到場掃描，自動開門。" [ref=e94]:
          - generic [ref=e95]: "02"
          - generic [ref=e96]:
            - heading "掃碼入場" [level=3] [ref=e97]
            - paragraph [ref=e98]: 預訂確認後即獲 QR 碼。到場掃描，自動開門。
        - button "03 累積積分 每次消費自動賺取積分，換取優惠及會員禮遇。 查看會員" [ref=e99]:
          - generic [ref=e100]: "03"
          - generic [ref=e101]:
            - heading "累積積分" [level=3] [ref=e102]
            - paragraph [ref=e103]: 每次消費自動賺取積分，換取優惠及會員禮遇。
            - link "查看會員" [ref=e104] [cursor=pointer]:
              - /url: /membership
    - region [ref=e105]:
      - generic [ref=e106]:
        - paragraph [ref=e107]: SPACE8
        - heading "定價" [level=2] [ref=e108]
        - paragraph [ref=e109]: 按時段收費，越連訂越抵玩。
        - list "Pricing periods" [ref=e110]:
          - listitem [ref=e111]:
            - heading "黃金時段" [level=3] [ref=e117]
            - paragraph [ref=e118]: 燈光亮起，今晚適合一起上場。
            - paragraph [ref=e119]: 每日 16:00–00:00
            - generic [ref=e120]:
              - generic [ref=e121]: $
              - generic [ref=e122]: "108"
              - generic [ref=e123]: ／小時
            - link "立即預訂" [ref=e124] [cursor=pointer]:
              - /url: /book
          - listitem [ref=e125]:
            - generic [ref=e126]: 最抵玩
            - heading "上午時段" [level=3] [ref=e134]
            - paragraph [ref=e135]: 清醒開局，第一杆更專注。
            - paragraph [ref=e136]: 每日 06:00–12:00
            - generic [ref=e137]:
              - generic [ref=e138]: $
              - generic [ref=e139]: "88"
              - generic [ref=e140]: ／小時
            - link "立即預訂" [ref=e141] [cursor=pointer]:
              - /url: /book
          - listitem [ref=e142]:
            - heading "下午時段" [level=3] [ref=e147]
            - paragraph [ref=e148]: 午后慢慢打，讓節奏留給自己。
            - paragraph [ref=e149]: 每日 12:00–16:00
            - generic [ref=e150]:
              - generic [ref=e151]: $
              - generic [ref=e152]: "98"
              - generic [ref=e153]: ／小時
            - link "立即預訂" [ref=e154] [cursor=pointer]:
              - /url: /book
    - region [ref=e155]:
      - generic [ref=e156]:
        - heading "會員制度。" [level=2] [ref=e157]
        - link "立即加入" [ref=e158] [cursor=pointer]:
          - /url: /membership
          - text: 立即加入›
      - generic "Membership tiers" [ref=e159]:
        - generic [ref=e160]:
          - heading "標準會員" [level=3] [ref=e164]
          - paragraph [ref=e165]: HK$1 = 1 積分。註冊即送 50 積分。
          - paragraph [ref=e166]: 新用戶自動加入標準會員，即時獲贈 50 積分。每消費 HK$1 累積 1 積分。Space Pilot 完整功能開放使用，個人總勝場自動累積，開始你的桌球之旅。
          - button "Expand \"標準會員\" details" [ref=e167] [cursor=pointer]
        - generic [ref=e170]:
          - heading "優越會員" [level=3] [ref=e174]
          - paragraph [ref=e175]: 800 積分起
          - paragraph [ref=e176]: 尊享禮遇，積分 1.5 倍加速。
          - paragraph [ref=e177]: 累積 800 積分晉升優越會員等級。解鎖專享年度個人戰績回顧報告。可用積分兌換時段折扣券。積分以 1.5 倍速度累積，升級更快。
          - button "Expand \"優越會員\" details" [ref=e178] [cursor=pointer]
        - generic [ref=e181]:
          - generic [ref=e182]: 最高等級
          - heading "尊榮會員" [level=3] [ref=e186]
          - paragraph [ref=e187]: 6,000 積分起
          - paragraph [ref=e188]: 極致玩家殿堂，積分雙倍，尊享特級禮遇。
          - paragraph [ref=e189]: 累積 6,000 積分達到尊榮會員最高等級。尊享不定期 SPACE8 專屬品牌周邊饋贈。個人桿櫃優先分配。新場地／新功能優先試用權。積分雙倍累積，為最投入的玩家而設。
          - button "Expand \"尊榮會員\" details" [ref=e190] [cursor=pointer]
    - generic [ref=e194]:
      - generic [ref=e195]:
        - heading "常見問題。" [level=2] [ref=e196]
        - paragraph [ref=e197]: 預訂、入場與場地守則，這裡都有答案。
      - generic [ref=e198]:
        - generic [ref=e199]:
          - button "如何預訂球桌？" [ref=e200] [cursor=pointer]
          - generic: 選擇日期、時段及時長，以 Apple Pay 或信用卡即時付款，確認后即獲 QR 碼。全程不需人工協助。
        - generic [ref=e204]:
          - button "預訂后如何入場？" [ref=e205] [cursor=pointer]
          - generic: 付款確認後，你將收到專屬 QR 碼。到場掃描門口感應器，系統自動開門，全程自助。
        - generic [ref=e209]:
          - button "可以取消或退款吗？" [ref=e210] [cursor=pointer]
          - generic [ref=e213]:
            - text: 所有預約一經確認，一律不設取消、改期或退款（臺風 8 號或以上／黑色暴雨警告除外，可申請改期）。詳情請参阅《場地使用守則及條款》
            - link "第三條" [ref=e214] [cursor=pointer]:
              - /url: /legal?doc=terms#section-3
            - text: 及
            - link "第六條" [ref=e215] [cursor=pointer]:
              - /url: /legal?doc=terms#section-6
            - text: 。
        - generic [ref=e216]:
          - button "惡劣天氣怎麼辦？" [ref=e217] [cursor=pointer]
          - generic: 【8 號或以上風球 / 黑色暴雨警告】 如常營業：場地自動化系統維持正常運作，閣下可評估安全后如常前往。 改期機制：若決定不前往，必須於原預約時間開始前以 WhatsApp 聯繫客服，即可安排於 7 天内免費改期（不設退款）。 逾期處理：超過預約時間才申請或未於 7 天内使用，將視為自動放棄權益。 【一般情況 / 其它天氣（如 3 號風球、紅雨）】 不設退改：除上述極端天氣守則外，所有預約一經確認，一律不接受取消、改期或退款。
        - generic [ref=e221]:
          - button "有問題如何聯繫？" [ref=e222] [cursor=pointer]
          - generic: 可透過 WhatsApp 聯繫我們，或發送電郵至 info@space8.com.hk，我們將盡快回復。
      - link "了解更多" [ref=e226] [cursor=pointer]:
        - /url: /faq
    - generic [ref=e229]:
      - generic [ref=e230]:
        - heading "如何前往" [level=2] [ref=e236]
        - paragraph [ref=e237]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
        - list [ref=e238]:
          - listitem [ref=e239]: 港鐵鑽石山站 A2 出口或啟德站 Airside C 出口步行約 8–10 分鐘
          - listitem [ref=e240]: 距離鑽石山站 A2 出口 500 米（建議路線）
          - listitem [ref=e241]: 亦可乘搭巴士或小巴至大有街附近下車
          - listitem [ref=e242]: 建議泊車：新科技廣場停車場（威信停車場）
        - generic [ref=e243]:
          - link "Google Maps 導航" [ref=e244] [cursor=pointer]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - link "立即預訂" [ref=e248] [cursor=pointer]:
            - /url: /book
      - iframe [ref=e250]:
        - link "Open in Maps (opens in new tab)" [ref=f2e4] [cursor=pointer]:
          - /url: about:invalid#zClosurez
          - text: Open in Maps
    - generic [ref=e252]:
      - generic [ref=e253]:
        - img "Space8" [ref=e254]
        - generic [ref=e255]:
          - link "WhatsApp" [ref=e256] [cursor=pointer]:
            - /url: https://wa.me/85261808022
          - link "Instagram" [ref=e259] [cursor=pointer]:
            - /url: https://instagram.com/space8.com.hk
      - generic [ref=e263]:
        - generic [ref=e264]:
          - generic [ref=e265]: 聯繫我們
          - link "Google Maps 導航" [ref=e267] [cursor=pointer]:
            - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
            - generic [ref=e268]:
              - button "Marker" [ref=e269]
              - generic [ref=e270]:
                - link "Leaflet" [ref=e271]:
                  - /url: https://leafletjs.com
                - text: "| ©"
                - link "CARTO" [ref=e276]:
                  - /url: https://carto.com/attributions
                - text: ©
                - link "OpenStreetMap" [ref=e277]:
                  - /url: https://www.openstreetmap.org/copyright
          - generic [ref=e284]:
            - generic [ref=e285]: 香港新蒲崗大有街 32 號泰力工業中心 3 樓 05 室
            - generic [ref=e286]: 港鐵鑽石山站或啟德站步行約 10 分鐘
            - link "Google Maps 導航" [ref=e287] [cursor=pointer]:
              - /url: https://www.google.com/maps/search/?api=1&query=%E6%B3%B0%E5%8A%9B%E5%B7%A5%E6%A5%AD%E4%B8%AD%E5%BF%83%2032%20Tai%20Yau%20Street%2C%20San%20Po%20Kong%2C%20Hong%20Kong
          - generic [ref=e288]: 每日 06:00 至 24:00
          - link "+852 6180 8022" [ref=e298] [cursor=pointer]:
            - /url: tel:+85261808022
          - link "Info@space8.com.hk" [ref=e304] [cursor=pointer]:
            - /url: mailto:Info@space8.com.hk
        - generic [ref=e305]:
          - heading "香港新蒲崗自助無煙智能中式桌球室" [level=2] [ref=e306]
          - paragraph [ref=e307]: SPACE8 是香港新蒲崗自助無煙智能中式桌球球室，兩間1T獨立球室, 每日 06:00 至 24:00 營業。網上預訂、二維碼自助入場. 專業設備，智能系統，聚光在桌球本身。鄰近鑽石山和啟德地鐵站，方便停車。
      - navigation [ref=e308]:
        - generic [ref=e309]:
          - generic [ref=e310]: 導航
          - generic [ref=e311]:
            - link "預訂" [ref=e312] [cursor=pointer]:
              - /url: /book
            - link "場地" [ref=e313] [cursor=pointer]:
              - /url: /venue
            - link "關於" [ref=e314] [cursor=pointer]:
              - /url: /about
            - link "博客" [ref=e315] [cursor=pointer]:
              - /url: /blog
            - link "會員" [ref=e316] [cursor=pointer]:
              - /url: /membership
        - generic [ref=e317]:
          - generic [ref=e318]: 法律
          - generic [ref=e319]:
            - link "常見問題" [ref=e320] [cursor=pointer]:
              - /url: /faq
            - link "場地使用守則及條款" [ref=e321] [cursor=pointer]:
              - /url: /legal
            - link "私隱政策" [ref=e322] [cursor=pointer]:
              - /url: /privacy
      - img "Stripe" [ref=e324]
      - generic [ref=e325]:
        - paragraph [ref=e326]: © 2026 SPACE8. All rights reserved.
        - generic [ref=e327]:
          - link "場地使用守則及條款" [ref=e328] [cursor=pointer]:
            - /url: /legal
          - link "私隱政策" [ref=e329] [cursor=pointer]:
            - /url: /privacy
          - link "制作團隊" [ref=e330] [cursor=pointer]:
            - /url: /credits
    - link "WhatsApp 聯繫我們" [ref=e331] [cursor=pointer]:
      - /url: https://wa.me/85261808022
      - tooltip "WhatsApp 我們"
  - region "Notifications alt+T"
  - alert [ref=e334]
```

# Test source

```ts
  1  | import { test } from '@playwright/test';
  2  | 
  3  | test('Find carousel on page', async ({ page }) => {
  4  |   await page.goto('http://localhost:3000/zh-HK');
  5  | 
  6  |   // Wait for page to load
  7  |   await page.waitForTimeout(3000);
  8  | 
  9  |   // Scroll down to facilities section
  10 |   await page.evaluate(() => window.scrollTo(0, 2000));
> 11 |   await page.waitForTimeout(1000);
     |              ^ Error: page.waitForTimeout: Test ended.
  12 | 
  13 |   // Look for any element with carousel in className
  14 |   const carouselElements = await page.evaluate(() => {
  15 |     const all = Array.from(document.querySelectorAll('*'));
  16 |     return all
  17 |       .filter(el => el.className && el.className.toString().toLowerCase().includes('carousel'))
  18 |       .map(el => ({
  19 |         tag: el.tagName,
  20 |         classes: el.className,
  21 |         text: el.textContent?.substring(0, 50)
  22 |       }));
  23 |   });
  24 | 
  25 |   console.log('Carousel elements found:', JSON.stringify(carouselElements, null, 2));
  26 | 
  27 |   // Also check for the text we expect
  28 |   const facilitiesText = await page.locator('text=專業設備').first().isVisible();
  29 |   console.log('Facilities text visible:', facilitiesText);
  30 | });
  31 | 
```