# OTP 完整修復與遷移進度報告

## 總覽

完整修復 OTP 登入問題,分為緊急止血(Part 0)和長期遷移(Part 1-5)。

**目標:** 從自訂 `whatsapp_otps` 系統遷移到 Supabase 原生 Phone Auth + Send SMS Hook

---

## ✅ Part 0 — 緊急止血(已完成並部署)

### 問題根源
- `complete_login_otp` RPC 返回 `[{ok, reason, otp_id, expires_at}]` (table)
- 舊代碼用 `completed !== true` 判斷,永遠失敗
- 導致所有 OTP 請求返回 `reservation_completion_failed`

### 修復內容
修改兩個文件:
1. [app/api/otp/send/route.ts:117-128](app/api/otp/send/route.ts#L117-L128)
2. [app/api/profile/complete/send-otp/route.ts:107-111](app/api/profile/complete/send-otp/route.ts#L107-L111)

改為:
```typescript
const completionRow = Array.isArray(completed) ? completed[0] : null
if (completionError || !completionRow?.ok) {
  // 正確判斷,會顯示實際的 reason
}
```

### 狀態
- ✅ 已提交: commit `24467a5`
- ✅ 已推送到 `main`
- ⏳ 等待 Luca 測試確認用戶可以登入

---

## ✅ Part 1 — Send SMS Hook Adapter(已完成,需配置)

### 實作內容
1. [app/api/auth/hooks/send-sms/route.ts](app/api/auth/hooks/send-sms/route.ts) — Supabase webhook endpoint
2. [lib/engagelab/send-hook.ts](lib/engagelab/send-hook.ts) — Engagelab adapter with HMAC-SHA256 驗證
3. [scripts/test-send-sms-hook.ts](scripts/test-send-sms-hook.ts) — 測試套件

### 安全特性
- HMAC-SHA256 webhook 簽名驗證
- 電話號碼在日誌中遮罩
- 結構化日誌用於審計

### 待完成配置
需要在 `.env.local` 和 Vercel 設定:

```bash
# 1. 生成 webhook secret
openssl rand -base64 32

# 2. 設定環境變數
SUPABASE_AUTH_HOOK_SECRET="<generated-secret>"
ENGAGELAB_SUPABASE_TEMPLATE_ID="<template-id>"
```

### 狀態
- ✅ 代碼已完成並推送
- ⏳ 需要配置環境變數
- ⏳ 需要在 Engagelab 創建帶 `{{code}}` 變數的模板

---

## ⏳ Part 2 — Supabase Dashboard 設定(待執行)

需要在 Supabase Dashboard 手動設定:

1. **Authentication → Hooks → Send SMS hook**
   - 類型: HTTPS
   - URL: `https://space8.com.hk/api/auth/hooks/send-sms`
   - 填入 Part 1 生成的 signing secret

2. **Authentication → Providers → Phone**
   - 確認已開啟 Phone provider

3. **Authentication → Rate Limits**
   - 檢查內建 rate limit 設定是否足夠

### 狀態
- ⏳ 等待 Luca 在 Dashboard 設定
- 📋 詳細步驟見 [docs/supabase-phone-auth-migration.md](docs/supabase-phone-auth-migration.md)

---

## ✅ Part 3 — Backfill 現有用戶電話(已完成)

### 執行結果
```
✅ 成功 backfill: 7/7 用戶
❌ 失敗: 0
✅ 無電話衝突
```

### 已更新的用戶
1. luca yau (+852 6427****)
2. space8 admin (+852 6180****)
3. James (+852 6110****)
4. Mike Lau (+852 6600****)
5. mikemike lau (+852 6180****)
6. Luca (+852 5667****)
7. Luca Yau (+852 5911****)

### 關鍵成果
- ✅ 所有現有用戶的電話已從 `public.users.phone` 同步到 `auth.users.phone`
- ✅ 防止遷移後現有用戶被當做新用戶,創建重複帳戶
- ✅ 保留所有歷史記錄(bookings、積分等)

### 狀態
- ✅ 已執行完成
- ✅ 驗證通過
- 📝 腳本: [scripts/backfill-auth-phones.ts](scripts/backfill-auth-phones.ts)

---

## ⏳ Part 4 — 前端遷移到 Supabase 原生 auth(待執行)

### 需要修改的文件

1. **[components/auth/AuthCard.tsx](components/auth/AuthCard.tsx)**
   - Line 417-439: 電話登入 OTP 發送
   - Line 476-498: 重發 OTP
   
   改為使用 Supabase 原生 API:
   ```typescript
   const { error } = await supabase.auth.signInWithOtp({
     phone: normalizedPhone,
     options: { captchaToken }
   })
   ```

2. **OTP 驗證部分**
   ```typescript
   const { error } = await supabase.auth.verifyOtp({
     phone: normalizedPhone,
     token: code,
     type: 'sms'
   })
   ```

### reCAPTCHA 整合
- Supabase 原生支援 `options.captchaToken`
- 使用現有的 `getRecaptchaToken()` 函數
- 不需要自己實作驗證邏輯

### Rate Limiting
- Supabase 有內建 rate limit (Dashboard 可配置)
- 檢查是否需要額外的應用層 rate limit

### 狀態
- ⏳ 待執行
- ⚠️ **重要:** 需要先完成 Part 0 測試 + Part 1-2 配置,確認 Send SMS Hook 可以正常發送
- 📋 修改前需要在 dev 環境完整測試

---

## ⏳ Part 5 — 舊系統退役(最後執行)

### 待退役的文件
移到 `_deprecated/` (不直接刪除):

1. `app/api/otp/send/route.ts` (Part 0 已修好的版本)
2. `app/api/otp/verify*/route.ts` (如果有獨立 verify route)
3. Supabase RPCs:
   - `reserve_login_otp`
   - `complete_login_otp`
   - `verify_login_otp`

### 保留項目
- `whatsapp_otps` 表保留至少一週
- 等 Luca 確認新系統穩定後再決定是否刪除

### 執行條件
- ✅ Part 0 測試通過
- ✅ Part 1-2 配置完成
- ✅ Part 3 backfill 完成
- ✅ Part 4 前端遷移完成並測試
- ✅ 新系統在 production 穩定運行至少 3-7 天
- ✅ 無用戶報告登入問題

### 狀態
- ⏳ 待最後執行
- ⚠️ **不要急著刪除舊系統**

---

## 測試清單

### Part 0 測試(緊急)
- [ ] Vercel 部署完成 (commit `24467a5`)
- [ ] 用真實電話測試 OTP 發送
- [ ] 確認不再出現 `reservation_completion_failed`
- [ ] 成功收到 SMS
- [ ] 完整登入流程通過

### Part 1-2 配置測試
- [ ] 環境變數已設定
- [ ] Engagelab template 已創建
- [ ] Supabase Dashboard hook 已配置
- [ ] 用 `scripts/test-send-sms-hook.ts` 測試 webhook
- [ ] 確認簽名驗證正常工作

### Part 4 前端測試
- [ ] **新用戶** 電話註冊/登入完整流程
- [ ] **現有用戶** 用電話登入返回原帳戶(不是新帳戶)
- [ ] 檢查 booking/積分記錄是否正確關聯
- [ ] reCAPTCHA 正常工作
- [ ] Rate limiting 正常工作
- [ ] 錯誤處理和用戶提示清晰

### Part 5 退役前測試
- [ ] 新系統在 production 穩定運行 >= 7 天
- [ ] 無登入相關錯誤報告
- [ ] 日誌確認所有 OTP 請求都走新系統
- [ ] 舊 API endpoints 確認無流量

---

## 風險與注意事項

### 🔴 關鍵風險
1. **重複帳戶風險 (已解決)**
   - Part 3 backfill 防止現有用戶被當做新用戶
   - 7/7 用戶已成功更新

2. **Part 0 未完全測試**
   - 緊急修復已推送,但 Luca 尚未確認實際可登入
   - 建議立即進行真實環境測試

3. **Part 1-2 配置未完成**
   - Send SMS Hook 的環境變數仍為空
   - 需要先配置才能執行 Part 4

### ⚠️ 執行順序重要性
必須嚴格按照 Part 0 → Part 3 → Part 1-2 → Part 4 → Part 5 執行:
- Part 0 是緊急止血,優先
- Part 3 必須在 Part 4 之前(防止重複帳戶)
- Part 5 必須在所有測試通過後才能執行

### 🔧 回滾計劃
如果 Part 4 出問題:
- Part 0 的修復已確保舊系統可用
- 可以暫停 Part 4 部署,繼續使用修復後的舊系統
- Part 3 的 backfill 對舊系統無影響,可安全保留

---

## 下一步行動

### 立即執行
1. **Luca 測試 Part 0**
   - 用真實電話測試登入
   - 確認 `reservation_completion_failed` 已解決
   - 截圖/日誌證明可以登入

### 短期(1-2 天內)
2. **完成 Part 1-2 配置**
   - 生成並設定 `SUPABASE_AUTH_HOOK_SECRET`
   - 在 Engagelab 創建 template
   - 在 Supabase Dashboard 設定 hook
   - 測試 webhook 可以發送 SMS

### 中期(配置完成後)
3. **執行 Part 4 前端遷移**
   - 在 dev 環境修改 AuthCard.tsx
   - 完整測試新用戶和現有用戶流程
   - 確認無問題後部署到 production

### 長期(穩定運行後)
4. **執行 Part 5 舊系統退役**
   - 觀察 7 天無問題
   - 將舊代碼移到 `_deprecated/`
   - 保留 `whatsapp_otps` 表作為歷史記錄

---

## 參考文檔

- [完整遷移指南](docs/supabase-phone-auth-migration.md)
- [Part 1 完成總結](docs/part-1-completion-summary.md)
- [Supabase Phone Auth 文檔](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase Send SMS Hook 文檔](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook)

---

**最後更新:** 2026-09-12  
**狀態:** Part 0 ✅ | Part 1 ✅ | Part 2 ⏳ | Part 3 ✅ | Part 4 ⏳ | Part 5 ⏳
