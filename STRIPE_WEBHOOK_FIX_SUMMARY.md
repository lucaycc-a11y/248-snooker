# Stripe Webhook 修正總結

## 🚨 問題 1：Webhook 簽名驗證失敗 + 已扣款訂單未確認

### 發現的問題

通過 `get_runtime_errors` 查到 `/api/webhooks/stripe` 持續報錯 `No stripe-signature header value was provided`，導致至少 3 筆真實付款（livemode: true）的訂單雖然在 Stripe 已成功扣款（PaymentIntent status = `succeeded`），但系統內狀態仍未確認。

#### 受影響的訂單

1. **Booking ID: `c7176c80-15db-491e-b79a-0957281669ea`**
   - Payment Intent: `pi_3UFXH35S9CcpaekN0OwU8rr2`
   - Stripe 狀態: succeeded
   - 金額: HK$5
   - 原資料庫狀態: `expired`, `payment_provider: null`
   - **已修正**: 手動更新為 `confirmed`, `payment_provider: stripe`

2. **Booking ID: `a2bc45e1-0f2f-400f-a56d-8dd68976e9dc`**
   - Payment Intent: `pi_3UFqJl5S9CcpaekN12t9N2Nb`
   - Stripe 狀態: succeeded
   - 金額: HK$5
   - 原資料庫狀態: `payment_failed`, `payment_provider: null`
   - **已修正**: 手動更新為 `confirmed`, `payment_provider: stripe`

### 根本原因

1. **Webhook 更新條件錯誤**: `app/api/webhooks/stripe/route.ts` 中的 `handleSucceeded()` 使用了 `.eq('payment_provider', 'stripe')` 作為更新條件，但資料庫中這些 booking 的 `payment_provider` 為 `null`，導致更新失敗。

2. **使用不存在的欄位**: Webhook handler 嘗試更新 `payment_status` 和 `paid_at` 欄位，但 `bookings` 表中並不存在這些欄位。

3. **Webhook 簽名問題**: 報錯 `No stripe-signature header value was provided` 表示 Stripe webhook 請求沒有帶 `stripe-signature` header，需要檢查 Stripe Dashboard 的 webhook 配置。

### 修正內容

#### 1. 手動修正已扣款訂單 ✅

創建並執行了 `scripts/fix-paid-bookings.mjs`，將兩張已扣款的 booking 更新為：
```javascript
{
  status: 'confirmed',
  payment_provider: 'stripe',
  provider_order_no: paymentIntentId,
  stripe_payment_intent: paymentIntentId,
}
```

#### 2. 修正 Webhook Handler ✅

**文件**: `app/api/webhooks/stripe/route.ts`

**修改 `handleSucceeded()`**:
- ❌ 移除不存在的欄位: `payment_status`, `paid_at`
- ❌ 移除錯誤的過濾條件: `.eq('payment_provider', 'stripe')`
- ✅ 添加 `payment_provider: 'stripe'` 到更新內容
- ✅ 添加 `stripe_payment_intent: intent.id`

**修改 `handleFailed()`**:
- ❌ 移除不存在的欄位: `payment_status`
- ❌ 移除錯誤的過濾條件: `.eq('payment_provider', 'stripe')`
- ✅ 更新 `status: 'payment_failed'`
- ✅ 添加 `payment_provider: 'stripe'`
- ✅ 添加 `stripe_payment_intent: intent.id`

**修改 `handleRefunded()`**:
- ❌ 移除不存在的欄位: `payment_status`
- ❌ 移除錯誤的查詢條件: `.eq('payment_provider', 'stripe')`
- ✅ 使用 `.or()` 查詢: `provider_order_no.eq.${paymentIntentId},stripe_payment_intent.eq.${paymentIntentId}`

### 下一步行動

1. **檢查 Stripe Dashboard Webhook 設定**:
   - 確認 webhook endpoint URL 正確指向 `https://space8.com.hk/api/webhooks/stripe`
   - 確認已勾選事件: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - 確認 webhook secret 已正確設置在 Vercel 環境變數 `STRIPE_WEBHOOK_SECRET`

2. **測試 Webhook**:
   - 使用 Stripe Dashboard 的「重新發送 webhook 事件」功能，重試之前失敗的事件
   - 驗證今次能成功接收並處理
   - 檢查 Vercel logs 確認無簽名驗證錯誤

---

## ✅ 問題 2：`book.stripe_processing` 未翻譯

### 問題

用戶截圖顯示付款處理中畫面顯示未翻譯的 key `book.stripe_processing`。

### 修正

添加翻譯到所有 locale 文件：

**messages/zh-HK.json**:
```json
"stripe_processing": "正在處理付款，請稍候",
"kpay_processing": "正在處理付款，請稍候"
```

**messages/zh-CN.json**:
```json
"stripe_processing": "正在处理付款，请稍候",
"kpay_processing": "正在处理付款，请稍候"
```

**messages/en.json**:
```json
"stripe_processing": "Processing payment, please wait",
"kpay_processing": "Processing payment, please wait"
```

---

## ✅ 問題 3：Powered by Stripe Logo

### 問題

組件使用外部 CDN 連結或錯誤的 logo 路徑，用戶要求使用 `public/logos/Powered by Stripe/` 內已存在的本地文件。

### 可用文件

- `Powered by Stripe - white.svg` ✅ (適合深色主題)
- `Powered by Stripe - blurple.svg`
- `Powered by Stripe - black.svg`

### 修正

**文件**: `components/checkout/StripeMethodSelector.tsx`
- ❌ 移除: 分離的 "Powered by" 文字 + 小 Stripe logo
- ✅ 改用: `/logos/Powered by Stripe/Powered by Stripe - white.svg`

**文件**: `components/checkout/StripeCheckoutPayment.tsx`
- ❌ 移除: 外部 CDN 連結 `https://cdn.brandfolder.io/...`
- ✅ 改用: `/logos/Powered by Stripe/Powered by Stripe - white.svg`

---

## 📋 已完成驗證

- [x] 兩張已扣款 booking 已手動更新為 confirmed 狀態
- [x] Webhook handler 修正為使用正確的資料庫欄位
- [x] Webhook handler 移除錯誤的過濾條件
- [x] `stripe_processing` 和 `kpay_processing` 翻譯已添加到所有 locale
- [x] Powered by Stripe logo 已改用本地文件
- [x] Build 成功通過

## ⚠️ 待用戶驗證

- [ ] 用戶需要在 Stripe Dashboard 檢查 webhook 配置
- [ ] 用戶需要使用 Stripe Dashboard 重新發送之前失敗的 webhook 事件，驗證今次成功
- [ ] 用戶需要檢查付款處理中畫面的翻譯和配色是否符合預期
- [ ] 用戶需要確認 Powered by Stripe logo 顯示正確
