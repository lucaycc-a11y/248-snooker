# Stripe Two-Stage Payment Flow - Test Report

**測試日期**: 2026-09-15  
**測試環境**: Local dev server (http://localhost:3000)  
**PAYMENT_PROVIDER**: stripe  

---

## Test Overview

根據原始需求，需要驗證 Stripe 實現咗同 KPay 一樣嘅兩階段流程：
- **Stage 1**: PaymentMethodList 選擇 payment method
- **Stage 2**: StripePayment component fork 到 Card UI 或者 QR UI
- **關鍵驗證點**: Card 同 QR 係互斥，唔會同時顯示

---

## Code Structure Analysis

### Stage 1: Payment Method Selection (book/page.tsx L2346-2366)

```typescript
{!confirmed ? (
  <PaymentMethodList
    selected={paymentMethod}
    onSelect={(method) => {
      setPaymentError(null)
      setPaymentMethod(method)
      // ... provider-specific handling
    }}
  />
) : ...}
```

**觸發條件**: `confirmed === false`  
**用戶操作**: 點擊 "信用卡" 或 "微信支付" 按鈕  
**State 變化**: `setPaymentMethod('card' | 'wechat_pay')`  

---

### Stage 2: Stripe Payment Execution (book/page.tsx L2367-2421)

```typescript
process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === 'stripe' 
  && paymentMethod !== null 
  && ['card', 'wechat_pay', ...].includes(paymentMethod)
? (
  <StripePayment
    method={paymentMethod as StripePaymentMethod}
    // ... props
  />
) : ...
```

**觸發條件**: 
1. `confirmed === true` (Stage 1 完成)
2. `PAYMENT_PROVIDER === 'stripe'`
3. `paymentMethod` 係 Stripe 支援嘅 method

---

## StripePayment Internal Routing (StripePayment.tsx)

### Card Payment Path

**條件**: `method === 'card'`

**UI Elements**:
- Stripe PaymentElement (`#payment-element`)
- Submit button
- NO QR code display

**Key Code** (StripePayment.tsx ~L550-600):
```typescript
{method === 'card' && (
  <form id="payment-form" onSubmit={handleCardSubmit}>
    <PaymentElement id="payment-element" options={paymentElementOptions} />
    <button type="submit" disabled={!stripe || !elements || isProcessing}>
      {labels.processing || 'Processing...'}
    </button>
  </form>
)}
```

---

### WeChat Pay QR Path

**條件**: `method === 'wechat_pay'`

**UI Elements**:
- QR code image (`wechatQrCode` state)
- Countdown timer
- Polling status updates
- NO PaymentElement

**Key Code** (StripePayment.tsx ~L650-700):
```typescript
{method === 'wechat_pay' && wechatQrCode && (
  <div data-testid="wechat-qr-code">
    <QRCodeSVG value={wechatQrCode} size={200} />
    <p>{labels.pending}</p>
    {/* countdown, polling UI */}
  </div>
)}
```

---

## Mutual Exclusion Verification

### Logic Analysis

**StripePayment.tsx 互斥保證**:

1. **Card path**: 
   - `method === 'card'` → render PaymentElement
   - `wechatQrCode` 保持 `null`（因為唔會 call `confirmWechatPayPayment`）

2. **WeChat path**:
   - `method === 'wechat_pay'` → call `confirmWechatPayPayment` → set `wechatQrCode`
   - PaymentElement 唔會 mount（條件 `method === 'card'` 唔成立）

3. **React conditional rendering**:
```typescript
{method === 'card' && <PaymentElement />}
{method === 'wechat_pay' && wechatQrCode && <QRCode />}
```

呢兩個條件係 **互斥** — 唔可能同時成立。

---

## Manual Test Plan

### Test Case 1: Card Payment Flow

**Steps**:
1. 打開 http://localhost:3000/zh-HK/book
2. 選擇日期 + 時段
3. **Stage 1**: 點擊 "信用卡" 按鈕
4. **Stage 2**: 驗證以下元素：
   - ✅ Stripe PaymentElement 出現 (`#payment-element`)
   - ✅ Submit button 出現
   - ❌ QR code 唔應該出現
   - ❌ Countdown timer 唔應該出現

**Expected Result**:
- 只顯示 Card payment UI
- 可以輸入卡號進行測試

---

### Test Case 2: WeChat Pay QR Flow

**Steps**:
1. 打開 http://localhost:3000/zh-HK/book
2. 選擇日期 + 時段
3. **Stage 1**: 點擊 "微信支付" 按鈕
4. **Stage 2**: 驗證以下元素：
   - ✅ QR code 出現 (`[data-testid="wechat-qr-code"]`)
   - ✅ Countdown timer 出現
   - ✅ Polling 開始（console log 應該顯示 polling 請求）
   - ❌ PaymentElement 唔應該出現
   - ❌ Card input fields 唔應該出現

**Expected Result**:
- 只顯示 WeChat QR UI
- QR code 可以掃描（需要 Stripe test mode）

---

## Environment Check

### Required Environment Variables

**檢查 .env.local**:
```bash
NEXT_PUBLIC_PAYMENT_PROVIDER=stripe  ✅ (required for Stage 2 routing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  ✅ (required for Stripe.js)
STRIPE_SECRET_KEY=sk_test_...  ✅ (required for backend)
STRIPE_WEBHOOK_SECRET=whsec_...  ✅ (required for webhook verification)
```

### Backend Endpoints Status

**Verified in this session**:
- ✅ `/api/payment/create-intent` - 已加 `payment_provider: 'stripe'`
- ✅ `/api/checkout/status` - 已加 provider routing
- ✅ `/api/webhooks/stripe` - 已改用 StripeProvider 直接處理
- ✅ `/api/stripe/create-payment-intent` - 已有 `payment_provider: 'stripe'`

---

## Test Execution Status

### Automated Testing
- ❌ Playwright test blocked by missing `@playwright/test` package
- ⚠️ 需要 `npm install -D @playwright/test` 先可以跑自動化測試

### Manual Testing
- ⏳ **PENDING** - 等待用戶確認開始手動測試
- 📋 Dev server 已經運行緊 (http://localhost:3000)
- 🖥️ Browser 已經打開咗 booking page

---

## Next Steps

1. **手動測試 Card payment flow**
   - 打開 Chrome DevTools
   - 選擇 "信用卡" → 驗證只有 PaymentElement
   - Take screenshot: `test-card-ui.png`

2. **手動測試 WeChat Pay QR flow**
   - 選擇 "微信支付" → 驗證只有 QR code
   - Take screenshot: `test-wechat-qr-ui.png`

3. **Compare screenshots**
   - 確認兩個 UI 完全互斥
   - 文檔化兩個 path 嘅差異

4. **Push to main + Vercel deployment**
   - Git commit + push
   - 驗證 production build

---

## Comparison with KPay Structure

### Structural Similarity (已達成)

| Aspect | KPay | Stripe | Status |
|--------|------|--------|--------|
| **Stage 1** | PaymentMethodList | PaymentMethodList | ✅ 相同 |
| **Stage 2 trigger** | `confirmed` state | `confirmed` state | ✅ 相同 |
| **Method routing** | `kpayMethod` → QR/H5/CNP | `method` → Card/QR | ✅ 相同 |
| **UI mutual exclusion** | CNP hosted vs QR | PaymentElement vs QR | ✅ 相同 |
| **State machine** | idle/pending/success/failed | idle/pending/success/failed | ✅ 相同 |
| **Polling** | `/api/checkout/status` | `/api/checkout/status` | ✅ 相同 |
| **Session persistence** | sessionStorage | sessionStorage | ✅ 相同 |

### Key Difference (Provider Implementation)

**KPay**:
- Card: CNP Hosted (redirect to KPay page)
- Direct methods: QR code or H5 redirect

**Stripe**:
- Card: PaymentElement (inline, no redirect)
- WeChat/Alipay: QR code (inline)

**結論**: 兩階段結構完全一致，只係 provider 實現唔同（符合原始需求）。

---

## Code Quality Check

### Type Safety ✅
- `StripePaymentMethod` type exported
- `StripeState` type exported
- No `any` types in routing logic

### Error Handling ✅
- Webhook idempotency check
- Status endpoint provider routing
- Missing `payment_provider` field 已修正

### Testability ✅
- `data-testid` attributes on QR code
- `#payment-element` ID for PaymentElement
- Clear state machine transitions

---

## Summary

**結構驗證**: ✅ PASS  
**後端修正**: ✅ COMPLETE  
**UI 測試**: ⏳ PENDING (waiting for manual verification)

Stripe 兩階段流程已經同 KPay 結構完全一致：
1. Stage 1 用同一個 PaymentMethodList
2. Stage 2 根據 method fork 到唔同 UI
3. Card 同 QR 係互斥（conditional rendering 保證）

下一步係手動測試 + screenshots 去視覺化驗證互斥性。
