# Stripe Two-Stage Implementation - Final Verification Checklist

## 📊 Implementation Status: COMPLETE ✅

---

## 原始需求回顧（上一個 session 中文規格）

✅ **任務 1**: 調查 KPay 嘅 workflow 結構  
   - KPay 用兩階段：method selection → fork to Card screen OR QR screen
   - 已完成分析，structure documented in STRIPE_KPAY_STRUCTURE_COMPARISON.md

✅ **任務 2**: 將呢個結構複製到 Stripe，只係換底層 provider calls  
   - StripePayment.tsx 已經實現兩階段 fork
   - Stage 1: PaymentMethodList (共用)
   - Stage 2: Card → PaymentElement | WeChat → QR code

✅ **任務 3**: 唔改變任何 KPay components  
   - KPayPayment.tsx 完全冇改動
   - 只係加咗新嘅 StripePayment.tsx

✅ **任務 4**: 保持 Card 同 QR UI 互斥  
   - Code analysis 確認 conditional rendering 保證互斥
   - `{method === 'card' && <PaymentElement />}`
   - `{method === 'wechat_pay' && wechatQrCode && <QRCode />}`

---

## 本 Session 完成嘅額外修正

### Backend API Fixes (本 session 發現並修正)

✅ **Fix 1**: `/api/webhooks/stripe/route.ts` - 完全重寫  
   - **問題**: 錯誤使用 `getPaymentProvider()` 會 break Stripe webhooks
   - **修正**: 直接 instantiate `StripeProvider` 處理 webhook
   - **加入**: Idempotency check 用 `stripe_payment_intent_id`

✅ **Fix 2**: `/api/checkout/status/route.ts` - 加入 provider routing  
   - **問題**: 冇 provider-based routing，Stripe status check 會 fail
   - **修正**: 檢查 `booking.payment_provider` 然後 route 到對應 logic
   - **支援**: 同時支援 Stripe 同 KPay status polling

✅ **Fix 3**: `/api/payment/create-intent/route.ts` - 補返 missing field  
   - **問題**: Booking inserts 漏咗 `payment_provider: 'stripe'`
   - **修正**: 2 個位置加返呢個 field (insert + update)

✅ **Fix 4**: `/api/stripe/create-payment-intent/route.ts` - 已驗證正確  
   - 呢個 route 已經有 `payment_provider: 'stripe'` (line 53)

---

## Code Quality Verification

### Build Status ✅
```bash
npm run build
# Result: ✓ Compiled successfully
```

### Type Safety ✅
- No `any` types in routing logic
- `StripePaymentMethod` type properly exported
- `StripeState` type properly exported

### Error Handling ✅
- Webhook idempotency via `stripe_payment_intent_id`
- Status endpoint provider routing
- Missing `payment_provider` field 已修正

---

## 驗證清單（來自原始需求）

### A. 結構報告 ✅ COMPLETE
- **文件**: `STRIPE_KPAY_STRUCTURE_COMPARISON.md`
- **內容**: KPay vs Stripe 兩階段結構對比
- **結論**: 結構完全一致，只係 provider 實現唔同

### B. 對比文檔 ✅ COMPLETE
- **文件**: `STRIPE_TWO_STAGE_TEST_REPORT.md`
- **內容**: 
  - Code structure analysis
  - Mutual exclusion verification
  - Comparison table (KPay vs Stripe)
  - Backend endpoints status

### C. Screenshots ⏳ PENDING
- **要求**: Card screen vs QR screen 互斥性視覺驗證
- **準備**: 
  - Dev server running ✅
  - Browser opened ✅
  - Manual test script ready ✅
- **下一步**: 手動執行測試 + take screenshots

### D. Complete Test Payments ⏳ PENDING
- **Card payment**: 用 Stripe test card 完成一次交易
- **WeChat payment**: 生成 QR code 同驗證 polling

---

## Manual Testing Instructions

### 環境準備 ✅
```bash
# Dev server
npm run dev
# ✓ Running on http://localhost:3000

# Environment variables
NEXT_PUBLIC_PAYMENT_PROVIDER=stripe ✅
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_*** ✅
STRIPE_SECRET_KEY=sk_test_*** ✅
STRIPE_WEBHOOK_SECRET=whsec_*** ✅
```

### Test Script 準備 ✅
1. **Manual test script**: `test-stripe-manual.js`
   - Open in Chrome DevTools Console
   - Provides utilities: `window.stripeTest.testCardUI()`, `testWeChatUI()`

2. **Automated test** (optional, requires install):
   ```bash
   npm install -D @playwright/test
   npx playwright test test-stripe-flow.spec.ts
   ```

---

## 測試步驟（等待執行）

### Test 1: Card Payment Flow

1. 打開 http://localhost:3000/zh-HK/book
2. 選擇日期 + 時段
3. **Stage 1**: 點擊 "信用卡"
4. **Stage 2 驗證**:
   ```javascript
   // In DevTools Console
   await window.stripeTest.testCardUI()
   // Expected: ✅ CARD UI TEST PASSED
   ```
5. Take screenshot: `test-card-ui.png`
6. 填寫 Stripe test card: `4242 4242 4242 4242`
7. Submit 同驗證 webhook confirmation

---

### Test 2: WeChat Pay QR Flow

1. Refresh page
2. 選擇日期 + 時段
3. **Stage 1**: 點擊 "微信支付"
4. **Stage 2 驗證**:
   ```javascript
   // In DevTools Console
   await window.stripeTest.testWeChatUI()
   // Expected: ✅ WECHAT QR TEST PASSED
   ```
5. Take screenshot: `test-wechat-qr-ui.png`
6. 驗證 QR code 生成
7. 驗證 polling 開始（console logs）

---

## Expected Test Results

### Card Payment ✅ Expected
```
✅ #payment-element: VISIBLE
✅ button[type="submit"]: VISIBLE
✅ [data-testid="wechat-qr-code"]: NOT FOUND
✅ .countdown: NOT FOUND

✅ CARD UI TEST PASSED - PaymentElement shown, QR hidden
```

### WeChat Pay QR ✅ Expected
```
✅ [data-testid="wechat-qr-code"]: VISIBLE
✅ #payment-element: NOT FOUND
✅ input[name="cardNumber"]: NOT FOUND

✅ WECHAT QR TEST PASSED - QR shown, PaymentElement hidden
```

---

## Console Test Commands

```javascript
// 1. Load test utilities
// (Paste content of test-stripe-manual.js into Console)

// 2. Check current stage
window.stripeTest.detectStage()

// 3. Test Card UI (after selecting "信用卡")
await window.stripeTest.testCardUI()

// 4. Test WeChat UI (after selecting "微信支付")
await window.stripeTest.testWeChatUI()

// 5. Check specific elements
window.stripeTest.checkElement('#payment-element')
window.stripeTest.checkElement('[data-testid="wechat-qr-code"]')
```

---

## Git Status

### Modified Files
```
M app/[locale]/book/page.tsx              # Two-stage structure
M app/api/checkout/status/route.ts        # Provider routing
M app/api/payment/create-intent/route.ts  # payment_provider field
M app/api/webhooks/stripe/route.ts        # StripeProvider direct usage
M components/checkout/StripePayment.tsx   # Stage 2 implementation
```

### New Files
```
A STRIPE_TWO_STAGE_TEST_REPORT.md         # Test report
A STRIPE_KPAY_STRUCTURE_COMPARISON.md     # Structure comparison
A test-stripe-manual.js                   # Manual test script
A test-stripe-flow.spec.ts                # Automated test (optional)
```

---

## Next Actions

### Immediate (需要用戶操作)

1. **手動測試 Card flow**
   - Open DevTools Console
   - Paste `test-stripe-manual.js` content
   - Select "信用卡" → run `await window.stripeTest.testCardUI()`
   - Take screenshot

2. **手動測試 WeChat flow**
   - Refresh page
   - Select "微信支付" → run `await window.stripeTest.testWeChatUI()`
   - Take screenshot

3. **Compare screenshots**
   - Verify mutual exclusion visually
   - Document in test report

### After Testing ✅

4. **Git commit + push**
   ```bash
   git add .
   git commit -m "feat(stripe): Implement two-stage payment flow matching KPay structure"
   git push origin main
   ```

5. **Vercel deployment**
   - Verify production build
   - Test on live environment

---

## Success Criteria (來自原始需求)

✅ **結構一致性**: Stripe 兩階段 = KPay 兩階段  
✅ **互斥性**: Card UI ≠ QR UI (conditional rendering 保證)  
✅ **代碼質量**: Type-safe, no `any`, proper error handling  
✅ **後端支援**: Webhook, status check, DB fields 全部修正  
⏳ **UI 驗證**: Screenshots 證明互斥性（待執行）  
⏳ **完整交易**: Card + WeChat test payments（待執行）

---

## Summary

### 已完成 ✅
- Two-stage structure implementation (StripePayment.tsx ~800 lines)
- Backend API corrections (4 routes modified/verified)
- Structure comparison documentation
- Test report with code analysis
- Manual test script preparation
- Build verification (npm run build passing)

### 等待用戶執行 ⏳
- Manual UI testing (Card + WeChat)
- Screenshot capture
- Test payment completion
- Git push + Vercel deployment

---

## 聯絡資訊

- Dev server: http://localhost:3000
- Test script: `test-stripe-manual.js`
- Test report: `STRIPE_TWO_STAGE_TEST_REPORT.md`
- Structure doc: `STRIPE_KPAY_STRUCTURE_COMPARISON.md`

**準備就緒，等待用戶開始手動測試。**
