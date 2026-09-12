# UAT Environment + Maintenance Gate Deployment Checklist

## 概覽 Overview

本文件記錄 `uat.space8.com.hk` UAT 環境部署及 Maintenance Gate 強化實施的完整清單。

This document records the complete checklist for deploying the `uat.space8.com.hk` UAT environment and Maintenance Gate enhancements.

---

## 1. UAT Domain Setup (Vercel)

### 1.1 Branch Configuration
- [ ] 在 Vercel Dashboard 中，將 `uat.space8.com.hk` 指向固定的 `uat` 或 `staging` branch
- [ ] 確認唔係指向所有 preview deployments，只係指向固定 branch
- [ ] 驗證：`git merge-base --is-ancestor main uat` 確認 merge 記錄正確

### 1.2 Environment Variables (UAT Branch)
確保以下環境變數喺 Vercel `uat` branch 環境設定：

```bash
# KPay UAT Keys (唔好將 production key 用喺 UAT)
KPAY_ENV=uat
KPAY_MERCHANT_CODE=[UAT merchant code]
KPAY_PRIVATE_KEY=[UAT private key]
KPAY_PLATFORM_PUBLIC_KEY=[UAT platform public key]

# Maintenance Gate
GATE_COOKIE_SECRET=[same secret across both domains]

# Other configs (same as production)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**重要：** `GATE_COOKIE_SECRET` 必須喺 production 同 UAT 一致，先至可以跨 domain 共用 maintenance bypass cookie。

---

## 2. KPay Webhook Configuration

### 2.1 KPay Dashboard Setup
- [ ] 登入 KPay Merchant Portal
- [ ] 為 UAT environment 設定 webhook URL：`https://uat.space8.com.hk/api/webhooks/kpay`
- [ ] 為 production environment 設定 webhook URL：`https://space8.com.hk/api/webhooks/kpay`
- [ ] 確認兩個 webhook 都有正確嘅 signature verification

### 2.2 Webhook Testing
- [ ] 喺 UAT domain 完成一次完整訂位流程
- [ ] 檢查 `payment_attempts` 表，確認 webhook 打到 UAT endpoint
- [ ] 檢查 production domain，確認 UAT webhook 唔會誤觸 production orders

---

## 3. Supabase Auth Configuration

### 3.1 Site URL and Redirect URLs
登入 Supabase Dashboard → Authentication → URL Configuration：

- [ ] **Site URL** 保持 `https://space8.com.hk`（主 domain）
- [ ] **Redirect URLs** 添加以下兩個：
  - `https://space8.com.hk/*`
  - `https://uat.space8.com.hk/*`

### 3.2 OAuth Provider Configuration (如有使用)
如果使用 Google / Apple / GitHub OAuth：

- [ ] 去每個 provider 嘅 developer console
- [ ] 添加 `https://uat.space8.com.hk/auth/callback` 到 authorized redirect URIs
- [ ] 確認 production callback 都仍然喺 whitelist

### 3.3 Testing
- [ ] UAT domain：測試 email + password 登入
- [ ] UAT domain：測試 OAuth 登入（如有）
- [ ] Production domain：確認登入仍然正常
- [ ] 確認兩個 domain 嘅 session 係獨立（唔會互相污染）

---

## 4. Database Configuration (`is_test` Isolation)

### 4.1 Schema Verification
確認以下欄位已存在（已喺之前 migration 建立）：

```sql
-- bookings 表
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- slots 表
ALTER TABLE slots ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- payment_method check constraint 已包含 'test'
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_method_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_method_check 
  CHECK (payment_method IN ('fps', 'payme', 'octopus', 'alipay', 'alipayhk', 'wechat', 'unionpay_qp', 'card', 'test'));
```

### 4.2 Availability Query Updates
需要更新所有讀取 `bookings` / `slots` 嘅 query，加入 `is_test = false` 過濾：

**主要位置：**
- [ ] Availability calculation queries (畀客人揀時段嗰啲)
- [ ] Admin dashboard queries (default exclude test data)
- [ ] 營業報表 / KPI 統計 queries
- [ ] Email / notification 觸發邏輯

**注意：** Admin dashboard 應該有一個 toggle 可以顯示 test data（但 default 應該 exclude）。

### 4.3 RLS Policy (Optional)
評估是否喺 RLS policy 層面直接加 `is_test` 限制：

```sql
-- Example: ensure non-admin users never see test bookings
CREATE POLICY "Users cannot see test bookings"
ON bookings FOR SELECT
USING (
  is_test = false
  OR auth.uid() IN (SELECT user_id FROM admin_members)
);
```

如果 RLS 改動範圍太大，可以先實現 application-layer filter，並喺 PR 描述講明呢個限制。

---

## 5. Test Data Cleanup

### 5.1 Manual Cleanup Function
- [ ] 建立 admin-only 手動觸發嘅清理功能
- [ ] 功能：刪除 / 封存 `is_test = true` 超過 N 日嘅 `bookings` 同 `slots`
- [ ] 位置建議：Admin Dashboard → Data Management

### 5.2 Automated Cleanup (Optional)
- [ ] 設定 Supabase Edge Function 或 cron job
- [ ] 定期（例如每週）自動清理超過 7 日嘅 test data
- [ ] 記錄清理動作到 audit log

---

## 6. Maintenance Gate Enhancement

### 6.1 IP Whitelist Management
現有功能檢查：
- [ ] Admin can add IPs to `site_gate_ip_whitelist` table
- [ ] Admin can remove IPs from whitelist
- [ ] Middleware correctly bypasses gate for whitelisted IPs
- [ ] `site_gate_access_log` correctly logs `method = 'whitelist'` access

### 6.2 Password Bypass
現有功能檢查：
- [ ] Password verification endpoint (`/api/gate/verify`) working
- [ ] Correct password sets `site_gate_bypass` cookie with HMAC signature
- [ ] Cookie has 1-hour expiry (configurable)
- [ ] `site_gate_access_log` correctly logs `method = 'password'` access

### 6.3 503 Response
- [ ] Middleware redirects to `/coming-soon` when gate blocks access
- [ ] `/coming-soon` page returns HTTP 503 (not 200)
- [ ] Response includes `Retry-After: 3600` header
- [ ] `site_gate_access_log` correctly logs `method = 'denied'` attempts

### 6.4 Access Logging
確認 `site_gate_access_log` 記錄以下資訊：
- [ ] `ip_address` - real client IP (from `x-forwarded-for` or `x-real-ip`)
- [ ] `method` - `'whitelist'` / `'password'` / `'denied'`
- [ ] `pathname` - attempted path
- [ ] `user_agent` - browser UA (optional)
- [ ] `created_at` - timestamp

---

## 7. UAT Badge Implementation

### 7.1 Component
- [ ] `components/UatBadge.tsx` created
- [ ] Uses client-side hostname detection (`window.location.hostname === 'uat.space8.com.hk'`)
- [ ] Positioned at bottom-left, `z-index: 9999`
- [ ] Uses Good Times font (or fallback)
- [ ] Text: "UAT TEST" or "INTERNAL TESTING"
- [ ] Orange background with black text for high visibility

### 7.2 Integration
- [ ] Badge added to `app/layout.tsx`
- [ ] Badge renders on all pages (including admin, member, auth)
- [ ] Badge does NOT render on production domain
- [ ] Badge does NOT block any interactive elements (`pointer-events: none`)

---

## 8. Code Implementation Checklist

### 8.1 Core Files Created/Modified

**Created:**
- [ ] `lib/env/uat.ts` - `isUatEnv()` and `getKPayEnv()` helpers
- [ ] `lib/env/hostname.ts` - `getHostname()` request helper
- [ ] `components/UatBadge.tsx` - UAT environment badge

**Modified:**
- [ ] `lib/payments/kpay.ts` - KPayProvider accepts `hostname` param
- [ ] `lib/payments/index.ts` - `getPaymentProvider(hostname)` signature
- [ ] `middleware.ts` - Enhanced `checkSiteGate()` with IP whitelist + 503 logging
- [ ] `app/layout.tsx` - Added `<UatBadge />`
- [ ] `app/coming-soon/route.ts` - Returns 503 status (optional, depends on implementation approach)

### 8.2 API Routes to Update
所有呼叫 `getPaymentProvider()` 嘅 API routes 需要傳入 `hostname`：

- [ ] `app/api/checkout/create/route.ts`
  ```typescript
  const hostname = getHostname(req)
  const provider = getPaymentProvider(hostname)
  ```
- [ ] `app/api/checkout/status/route.ts`
- [ ] `app/api/pilot/create-renewal-order/route.ts`
- [ ] `app/api/webhooks/kpay/route.ts` (if it calls provider methods)

### 8.3 Booking Creation Logic
喺建立 `bookings` / `slots` 嘅地方，需要根據 hostname 設定 `is_test`：

```typescript
import { isUatEnv } from '@/lib/env/uat'
import { getHostname } from '@/lib/env/hostname'

const hostname = getHostname(req)
const isTest = isUatEnv(hostname)

// Insert booking
await supabase.from('bookings').insert({
  ...bookingData,
  is_test: isTest,
})

// Insert slots
await supabase.from('slots').insert(
  slotsData.map(slot => ({ ...slot, is_test: isTest }))
)
```

主要位置：
- [ ] `app/api/checkout/create/route.ts` - booking creation
- [ ] Slot creation logic (wherever slots are inserted)

---

## 9. Testing & Verification

### 9.1 UAT Domain Testing
- [ ] uat.space8.com.hk 實際指向 `uat` branch
- [ ] Badge 顯示 "UAT TEST" 喺左下角
- [ ] 用 DevTools Network tab 證實用緊 KPay UAT key (check request URL: `payment.uat.kpay-group.com`)
- [ ] 完成一次完整訂位流程（選時段 → 付款 → 確認）
- [ ] 查 DB：對應 `bookings` / `slots` row 嘅 `is_test = true`

### 9.2 Production Domain Testing
- [ ] space8.com.hk 冇顯示 badge
- [ ] DevTools 證實用緊 KPay production key (check request URL: `payment.kpay-group.com`)
- [ ] 完成一次訂位流程
- [ ] 查 DB：對應 `bookings` / `slots` row 嘅 `is_test = false`

### 9.3 Data Isolation Testing
- [ ] 喺 UAT domain 建立一個 test booking（`is_test = true`）
- [ ] 去 production domain 嘅 availability 頁面，確認該時段仍然顯示為 available（唔會俾 test booking 鎖住）
- [ ] 截圖 / query 結果對比證明 isolation 有效

### 9.4 Maintenance Gate Testing

**IP Whitelist:**
- [ ] 用非白名單 IP（例如手機數據網絡）訪問 production domain
- [ ] 確認見到 coming-soon 頁面
- [ ] DevTools Network tab 查證 status code 係 503（唔係 502 或 200）
- [ ] Response headers 包含 `Retry-After: 3600`
- [ ] 查 `site_gate_access_log`：有對應記錄，`method = 'denied'`

**Whitelist Bypass:**
- [ ] 將你嘅 IP 加入 `site_gate_ip_whitelist`
- [ ] 重新訪問，應該見返正常首頁（唔係 coming-soon）
- [ ] 查 `site_gate_access_log`：有記錄，`method = 'whitelist'`

**Password Bypass:**
- [ ] 用非白名單 IP 訪問，見到 coming-soon 頁面
- [ ] 輸入正確 gate password
- [ ] 驗證成功後，應該見返正常首頁
- [ ] 查 `site_gate_access_log`：有記錄，`method = 'password'`
- [ ] 檢查 cookie：`site_gate_bypass` 已設定，1 小時 expiry

**Password Wrong:**
- [ ] 輸入錯誤密碼
- [ ] 確認見到 error message，仍然停留喺 coming-soon 頁面
- [ ] 查 `site_gate_access_log`：有記錄，`method = 'denied'`

### 9.5 Cross-Domain Login Testing
- [ ] UAT domain: Google / Apple login 成功
- [ ] Production domain: Google / Apple login 成功
- [ ] 確認兩個 domain 嘅 session 獨立（喺 UAT login 唔會自動 login production）

### 9.6 Webhook Testing
- [ ] 喺 UAT domain 完成一筆訂位付款
- [ ] 查 server logs：確認 KPay webhook 打到 `https://uat.space8.com.hk/api/webhooks/kpay`
- [ ] 查 `payment_attempts` table：對應訂單 status 正確更新
- [ ] 重複測試 production domain，確認 webhook 打到 production endpoint

---

## 10. Deployment Steps

### 10.1 Pre-Deployment
1. [ ] 所有 code changes reviewed and merged to `uat` branch
2. [ ] Vercel environment variables configured for `uat` branch
3. [ ] KPay webhook URLs updated (UAT + production)
4. [ ] Supabase Auth redirect URLs updated
5. [ ] Database schema verified (is_test columns exist)

### 10.2 Deploy to UAT
1. [ ] Push to `uat` branch
2. [ ] Vercel auto-deploys to `uat.space8.com.hk`
3. [ ] Run verification checklist (§9.1 - 9.6)
4. [ ] Fix any issues found

### 10.3 Deploy to Production (when ready)
1. [ ] Merge `uat` branch → `main`
2. [ ] Vercel auto-deploys to `space8.com.hk`
3. [ ] Run production verification (§9.2)
4. [ ] Monitor for 24 hours

---

## 11. Known Limitations & Future Work

### 11.1 Current Limitations
- [ ] **RLS Policy 未改** - `is_test` filtering 依賴 application-layer queries，未喺 RLS policy 層面強制執行。風險：如果有 query 漏咗加 `WHERE is_test = false`，test data 可能會 leak 出嚟。
- [ ] **字體授權未確認** - UAT badge 使用 Good Times 字體，但未確認有冇合法 webfont 授權檔案。如果冇，已用視覺相近嘅字體代替（需要喺 PR 講明）。
- [ ] **Automated cleanup 未實現** - Test data 清理依賴手動觸發，未有 automated cron job。

### 11.2 Future Enhancements
- [ ] 實現 RLS policy 層面嘅 `is_test` 過濾，減少 application-layer bug 風險
- [ ] 設定 Supabase Edge Function 定期清理 test data
- [ ] Admin dashboard 加入 test data visibility toggle
- [ ] 建立 test data 統計報表（有幾多 test bookings / slots 存在）
- [ ] 考慮將 UAT environment 完全獨立嘅 Supabase project（避免 test data 污染 production DB）

---

## 12. Rollback Plan

如果發現嚴重問題需要 rollback：

1. [ ] Vercel Dashboard → Deployments → 搵返上一個 stable deployment → "Promote to Production"
2. [ ] 如果 database migration 有改動，run rollback migration：
   ```sql
   -- Only if you added new columns/constraints
   ALTER TABLE bookings DROP COLUMN IF EXISTS is_test;
   ALTER TABLE slots DROP COLUMN IF EXISTS is_test;
   ```
3. [ ] Revert KPay webhook URLs to original configuration
4. [ ] Remove UAT domain from Supabase redirect URLs (if needed)

---

## 13. Contact & Support

遇到問題請聯繫：

- **Backend / Infra**: [your-email]
- **KPay Integration**: [kpay-support-email]
- **Vercel Deployment**: [vercel-support-email]
- **Supabase Config**: [supabase-support-email]

---

## Changelog

- **2026-09-12**: Initial checklist created
- **[Date]**: UAT deployed and verified
- **[Date]**: Production deployed and verified
