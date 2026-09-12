# Stripe Integration Implementation Summary

## 完成日期
2026-09-12

## 實施範圍

成功將 Stripe 作為 Space8 的可選支付提供商整合，與現有 KPay 並存，通過環境變數 `PAYMENT_PROVIDER` 切換。

---

## 已完成的修改

### 後端修改

#### 1. Payment Provider Factory ([lib/payments/index.ts](lib/payments/index.ts))
- ✅ 加入 `PAYMENT_PROVIDER` 環境變數判斷
- ✅ 根據環境變數返回 `StripeProvider` 或 `KPayProvider`
- ✅ 保持 KPay 完全不變

#### 2. Stripe Provider ([lib/payments/stripe.ts](lib/payments/stripe.ts))
- ✅ `createOrder()` 加入 metadata：
  - `booking_id` — webhook 用於確認訂單
  - `user_id` — webhook 用於通知
  - `order_group_id` — 多時段訂單支援
  - `out_trade_no` — 人類可讀訂單號
- ✅ 修正 `kind` 返回值：`'client_secret'` (前端用 Payment Element)
- ✅ 已支援 `automatic_payment_methods: { enabled: true }`（從 Dashboard 讀取已啟用的方法）

#### 3. Payment Types ([lib/payments/types.ts](lib/payments/types.ts))
- ✅ `CreateOrderParams` 加入 `userId?` 和 `orderGroupId?`
- ✅ `PayInfoKind` 加入 `'client_secret'` 類型

#### 4. Checkout API ([app/api/checkout/create/route.ts](app/api/checkout/create/route.ts))
- ✅ 移除全局 Apple Pay/Google Pay block（L91-96）
- ✅ 改為僅針對 KPay 的條件性 block
- ✅ `validMethods` 加入 `'apple_pay'` 和 `'google_pay'`
- ✅ `createAndStamp()` 傳遞 `userId` 和 `orderGroupId` 給 provider

#### 5. Stripe Webhook Handler ([app/api/webhooks/stripe/route.ts](app/api/webhooks/stripe/route.ts))
- ✅ **已驗證**：正確讀取 `booking_id`、`user_id`、`order_group_id` metadata（L271-272, L280）
- ✅ 支援單筆和多時段訂單確認
- ✅ Idempotency 處理完整
- ✅ 支援 `payment_intent.succeeded`、`payment_intent.payment_failed`、`charge.refunded`

### 前端修改

#### 6. Payment Method List ([components/checkout/PaymentMethodList.tsx](components/checkout/PaymentMethodList.tsx))
- ✅ `PaymentMethodId` 加入 `'apple_pay'` 和 `'google_pay'`
- ✅ 定義 Stripe 方法清單：`["card", "alipay", "google_pay", "apple_pay"]`
- ✅ 定義 KPay 方法清單：`["card", "alipayhk", "payme"]`
- ✅ 根據 `NEXT_PUBLIC_PAYMENT_PROVIDER` 動態切換（client-side 讀取）
- ✅ 加入 Apple Pay 和 Google Pay 的 UI 配置（圖示暫用 emoji，可後續替換為正式 icon）

#### 7. Stripe Checkout Payment Component ([components/checkout/StripeCheckoutPayment.tsx](components/checkout/StripeCheckoutPayment.tsx))
- ✅ **新建**：統一 checkout 流程組件（使用 `/api/checkout/create`）
- ✅ 使用 Stripe Payment Element（支援 card, alipay, apple_pay, google_pay）
- ✅ **Wallet Fallback 實作**：
  - 使用 `stripe.paymentRequest().canMakePayment()` 檢測 wallet 支援性
  - 如果不支援，顯示輕量提示：「此裝置不支援 {wallet}，已切換至信用卡付款」
  - Payment Element 自動 fallback 至 card 輸入表單
  - 不阻擋流程，不需要用戶額外操作

### 配置文件

#### 8. Environment Variables ([.env.local](.env.local))
- ✅ 加入 `PAYMENT_PROVIDER=kpay` 環境變數（預設 KPay）
- ✅ 配置說明文檔

---

## 驗證清單

### 環境變數切換驗證

- [ ] 設定 `PAYMENT_PROVIDER=kpay`，確認 checkout 使用 KPay 流程
  - [ ] PaymentMethodList 顯示 `["card", "alipayhk", "payme"]`
  - [ ] 選擇方法後渲染 `KPayPayment` 組件
  - [ ] 完整 KPay 支付流程無變化

- [ ] 設定 `PAYMENT_PROVIDER=stripe`，確認 checkout 使用 Stripe 流程
  - [ ] PaymentMethodList 顯示 `["card", "alipay", "google_pay", "apple_pay"]`
  - [ ] 選擇方法後渲染 `StripeCheckoutPayment` 組件

### Stripe 支付流程驗證

#### Card 支付
- [ ] 選擇 Credit Card，Payment Element 顯示卡片輸入表單
- [ ] 輸入測試卡號 `4242 4242 4242 4242`，成功付款
- [ ] Webhook 收到 `payment_intent.succeeded`
- [ ] `bookings` 表狀態更新為 `confirmed`
- [ ] 確認 email 和通知發送

#### Alipay 支付
- [ ] 選擇 Alipay，Payment Element 顯示 Alipay 選項
- [ ] 點擊後跳轉至 Alipay 沙盒頁面
- [ ] 完成支付後正確返回 `/book/confirm`
- [ ] Webhook 確認訂單

#### Apple Pay（支援裝置）
- [ ] 在 Safari (iOS/macOS with Apple Pay) 選擇 Apple Pay
- [ ] Payment Element 顯示 Apple Pay 按鈕
- [ ] 點擊喚起 Apple Pay 介面
- [ ] 完成支付流程

#### Apple Pay（不支援裝置）
- [ ] 在不支援 Apple Pay 的瀏覽器（如 Desktop Chrome）選擇 Apple Pay
- [ ] 看到提示：「此裝置不支援 Apple Pay，已切換至信用卡付款」
- [ ] Payment Element 自動顯示卡片輸入表單
- [ ] 可以正常使用卡片完成支付

#### Google Pay（支援裝置）
- [ ] 在已設定 Google Pay 的 Chrome 選擇 Google Pay
- [ ] Payment Element 顯示 Google Pay 按鈕
- [ ] 點擊喚起 Google Pay 介面
- [ ] 完成支付流程

#### Google Pay（不支援裝置）
- [ ] 在不支援 Google Pay 的瀏覽器選擇 Google Pay
- [ ] 看到提示：「此裝置不支援 Google Pay，已切換至信用卡付款」
- [ ] Payment Element 自動顯示卡片輸入表單
- [ ] 可以正常使用卡片完成支付

### Webhook 驗證

- [ ] 測試 `payment_intent.succeeded` — 訂單確認成功
- [ ] 測試 `payment_intent.payment_failed` — slot lock 正確釋放
- [ ] 測試 `charge.refunded` — 退款正確記錄
- [ ] 驗證 webhook idempotency — 重複事件不重複處理
- [ ] 確認 metadata 正確讀取：
  - [ ] `booking_id` 用於查詢 booking
  - [ ] `user_id` 用於發送通知
  - [ ] `order_group_id` 用於多時段訂單

### 多時段訂單驗證

- [ ] 選擇多個時段（grouped booking）
- [ ] 使用 Stripe 完成支付
- [ ] Webhook 正確確認整個 order group
- [ ] 所有 bookings 同時更新為 `confirmed`

### 錯誤處理驗證

- [ ] Stripe API 失敗（無效 secret key）— 顯示清晰錯誤
- [ ] 支付失敗（卡片被拒）— 顯示 Stripe 的本地化錯誤訊息
- [ ] Webhook 簽名驗證失敗 — 返回 400
- [ ] 金額不符 — webhook 拒絕確認

---

## 未來改進建議

1. **Apple Pay / Google Pay 圖示**
   - 目前使用 emoji placeholder（🍎 / 🅖）
   - 建議替換為官方 icon 或 SVG

2. **Payment Element 本地化**
   - 目前已支援 `zh-HK`, `zh`, `en`, `ja`
   - 確認所有文案在各語言下正確顯示

3. **前端 provider 檢測優化**
   - 目前使用 `window.NEXT_PUBLIC_PAYMENT_PROVIDER`
   - 可改為從 API 端點讀取（避免前端直接讀環境變數）

4. **Wallet fallback UI 優化**
   - 目前是綠色提示框
   - 可根據設計系統調整樣式

---

## 技術決策記錄

### 為什麼選擇 Payment Element 而非 Express Checkout Element？

- **原因**：Alipay 只支援 Payment Element，不支援 Express Checkout Element
- **結果**：統一使用 Payment Element 處理所有 4 種方法，減少前端分支
- **來源**：[Stripe Express Checkout Element 文檔](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment)

### Wallet Fallback 行為

- **要求**：PaymentMethodList 必須永遠顯示 Apple Pay / Google Pay，不做 capability detection
- **實作**：
  - UI 層：PaymentMethodList 永遠顯示所有 4 種方法
  - 行為層：選中 wallet 後，用 `paymentRequest.canMakePayment()` 檢測
  - Fallback：不支援時顯示提示，Payment Element 自動降級為 card
- **來源**：[Stripe Payment Request Button 文檔](https://docs.stripe.com/stripe-js/elements/payment-request-button)

### Metadata 設計

- **`booking_id`**：webhook 查詢 booking row 並確認
- **`user_id`**：webhook 發送通知給用戶
- **`order_group_id`**：多時段訂單的 group 確認
- **`out_trade_no`**：人類可讀的訂單號（用於客服查詢）

---

## 相關文檔

- [Stripe Payment Element 官方文檔](https://docs.stripe.com/payments/payment-element)
- [Stripe PaymentIntent API](https://docs.stripe.com/api/payment_intents/create)
- [Stripe Webhook 處理](https://docs.stripe.com/webhooks)
- [Stripe 測試卡號](https://docs.stripe.com/testing)

---

## 聯絡人

- 實作者：Claude (Opus 5)
- 日期：2026-09-12
- Repo: https://github.com/lucaycc-a11y/248-snooker
