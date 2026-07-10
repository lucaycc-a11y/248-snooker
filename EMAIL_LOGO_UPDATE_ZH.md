# Space8 Email Logo 升級完成報告

## ✅ 已完成工作

### 1. 全部9個Supabase Auth Email加大Logo

所有email template頂部已改用大版PNG logo：

**Logo規格：**
- 顯示闊度：320px（佔email容器600px嘅53%）
- 實際解像度：960px × ~527px @3x（確保Retina螢幕清晰）
- 格式：PNG（email client必須用PNG，唔可以用SVG）
- URL：`https://248.formhk.com/logos/space8-logo-email.png`

**已更新嘅9個templates：**
1. confirm-signup.html — 註冊確認email
2. invite.html — 邀請用戶email
3. magic-link.html — 免密碼登入（OTP code + magic link）
4. change-email.html — 確認新email
5. reset-password.html — 重設密碼
6. reauthentication.html — 重新驗證身份
7. password-changed.html — 密碼已更改通知
8. email-changed.html — Email已更改通知
9. phone-changed.html — 電話已更改通知

### 2. 創建SVG轉PNG轉換script

**檔案：** `scripts/convert-logo-for-email.js`

呢個Node.js script會將`Space8_full_icon_white_black_bkg.svg`轉做高解像度PNG。

### 3. 修正client/server架構問題

原本`MemberDashboard.tsx` (client component) 直接import server-side嘅QR generation，會引致webpack build error。已修正為：

- 新增API endpoint：`app/api/member/qr/route.ts`
- Member dashboard改為fetch API而唔係直接生成QR
- 保持client/server分離，符合Next.js 14 App Router規範

### 4. 更新README文檔

`supabase/email-templates/README.md` 已加入：
- Logo setup步驟（必須先做）
- 轉換script使用指引
- Email client測試checklist（強調Outlook兼容性）
- Logo顯示要求（大而顯眼，唔係細細粒）

## 📋 你要做嘅嘢（Next Steps）

### ⚠️ 第1步：轉換同上傳Logo PNG（必須）

**重要：** 如果冇做呢步，所有email頂部會顯示broken image icon！

```bash
# 1. 安裝sharp（如果未裝）
npm install sharp --save-dev

# 2. 執行轉換script
node scripts/convert-logo-for-email.js

# 3. 驗證PNG已生成
ls -lh public/logos/space8-logo-email.png
# 應該顯示 ~100-200KB 嘅PNG檔案

# 4. Deploy或上傳PNG
# 如果用Vercel：deploy就自動host喺public URL
# 如果手動upload：upload去你哋CDN同confirm URL正確

# 5. 測試URL
# 打開 https://248.formhk.com/logos/space8-logo-email.png
# 應該顯示白色Space8 logo（黑底或透明底）
```

### 第2步：Upload全部9個Email Templates去Supabase Dashboard

去 Supabase Dashboard → Authentication → Email Templates

逐個template複製HTML去editor：

| Template Type | 檔案 |
|---------------|------|
| Confirm signup | `supabase/email-templates/confirm-signup.html` |
| Invite user | `supabase/email-templates/invite.html` |
| Magic Link | `supabase/email-templates/magic-link.html` |
| Change Email Address | `supabase/email-templates/change-email.html` |
| Reset Password | `supabase/email-templates/reset-password.html` |
| Reauthentication | `supabase/email-templates/reauthentication.html` |
| Password Changed | `supabase/email-templates/password-changed.html` |
| Email Changed | `supabase/email-templates/email-changed.html` |
| Phone Changed | `supabase/email-templates/phone-changed.html` |

每個template打開，全選(Cmd+A)，複製，去Supabase Dashboard揀對應嘅template type，貼上，撳Save。

### 第3步：Email Client測試

**必須測試嘅email clients：**

1. **Gmail** (web + mobile app)
2. **Outlook** (web + desktop) ← **最重要！** Outlook最嚴格，佢得就其他都得
3. **iOS Mail** (iPhone/iPad)
4. **Android Gmail**

**測試checklist：**
- [ ] Logo顯示正確（白色Space8 logo，闊度~320px，夠大夠顯眼）
- [ ] Logo冇broken（冇顯示broken image icon）
- [ ] 綠色CTA按鈕清楚可見
- [ ] 背景係黑色（太空主題）
- [ ] Starfield效果顯示（如果email client支援；唔支援都OK，純裝飾）
- [ ] 所有連結work（點擊CTA按鈕同底部連結都正常）
- [ ] Mobile responsive正常（手機睇冇問題）

**點樣測試：**

Staging environment度trigger各種auth flow（註冊、重設密碼等），check收到嘅email rendering。

### 第4步：QR Code硬件測試（如有GM65 scanner）

如果你哋有GM65 scanner硬件：

1. Trigger booking confirmation email → scan QR code → verify door access
2. Member dashboard → 打開QR modal → scan → verify door access
3. Test backup code手動輸入（如果QR scan失敗）

## 🎨 Logo技術細節

### 為咩要用PNG唔用SVG？

Email client（特別係Outlook）對SVG支援好差：
- Outlook desktop完全唔render SVG
- Gmail有時會block SVG當安全風險
- PNG係唯一100%兼容嘅格式

### 點解要@3x解像度？

- 顯示闊度：320px
- 實際PNG闊度：960px (320px × 3)
- 確保喺Retina螢幕（iPhone、MacBook等）清晰唔矇

### 點解要用絕對URL？

Email client唔support相對路徑（`/logos/xxx.png`）。必須用完整URL：
```html
<img src="https://248.formhk.com/logos/space8-logo-email.png" ... />
```

## 📊 修改摘要

### 新增檔案
- `scripts/convert-logo-for-email.js` — SVG→PNG轉換script
- `app/api/member/qr/route.ts` — Member QR API endpoint
- `EMAIL_LOGO_UPDATE_ZH.md` — 呢份中文報告

### 修改檔案
- `supabase/email-templates/*.html` (全部9個) — 加大PNG logo
- `supabase/email-templates/README.md` — 加入logo setup步驟
- `app/member/MemberDashboard.tsx` — 改用API fetch QR（唔係直接生成）

### 冇改嘅嘢
- Booking confirmation email已經有QR code（之前已做）
- QR generation system (`lib/qrcode.ts`) 無變
- Email design system（黑底、綠CTA、starfield）無變

## ⚠️ 重要提醒

1. **Logo PNG係blocking task** — 如果冇upload，全部email頂部會broken
2. **Outlook測試最緊要** — 佢最嚴格，佢work其他就一定work
3. **手機都要測** — Email喺mobile睇得最多，responsive layout要正常
4. **URL要match** — Template入面寫`https://248.formhk.com/logos/space8-logo-email.png`，upload去嘅PNG必須accessible喺呢個URL

## 🚀 完成後預期效果

用戶收到任何auth email（註冊、重設密碼等）時：

1. **Email頂部** — 大版Space8 logo（白色，~320px闊）
2. **太空主題** — 純黑背景，CSS starfield效果
3. **綠色CTA** — 清晰嘅按鈕（#22c55e綠色）
4. **品牌一致性** — 同網站landing page同一視覺風格

所有email client（包括Outlook）都會正確顯示。
