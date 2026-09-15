# Stripe UI 最終方向實作計劃

## 現況分析

### 當前流程
1. 用戶見到 `PaymentMethodList`（6行選項列表）
2. 揀咗一個付款方式後，`confirmed = true`
3. 根據 provider 顯示：
   - `PAYMENT_PROVIDER=stripe` → `StripePayment`（Stripe PaymentElement accordion）
   - `PAYMENT_PROVIDER=kpay` → `KPayPayment`（KPay QR/H5）

### 結構性問題

**Requirement vs Reality:**

要求話：「六個付款方式全部要顯示」for Stripe

但 Stripe 嘅 PaymentElement 有兩個限制：
1. 唔支援 6-row radio list UI（只支援 accordion/tabs）
2. Dashboard 而家得 Card + WeChat Pay 開咗（Alipay/Google Pay/Apple Pay 未啟用）

**兩個可行方案：**

### 方案 A：兩階段 UI（推薦）
1. **Stage 1: Payment Method Selection**（顯示 6 個選項）
   - KPay: 6-row list（現有）
   - **Stripe: 新設計嘅 6-row list**（唔係用 PaymentElement，自己設計）
   
2. **Stage 2: Payment Details Input**
   - KPay: QR code / H5 redirect
   - Stripe: **PaymentElement accordion**（只顯示用戶 Stage 1 揀咗嗰個 method）

**優點：**
- 六個方法都有獨立入口（符合要求）
- 未開通嘅方法可以顯示「即將推出」
- 視覺上 Stripe 有自己一套設計（唔係跟 KPay）

### 方案 B：單階段 accordion（Stripe 原生）
1. 直接顯示 Stripe PaymentElement（accordion）
2. PaymentElement 會自動顯示 Dashboard 已開通嘅方法
3. 未開通嘅方法唔會出現

**缺點：**
- 唔符合「六個方法全部要顯示」呢個要求
- 無法預告未開通嘅方法

---

## 推薦方案：方案 A（兩階段 UI）

### 檔案結構

```
components/checkout/
├── PaymentMethodList.tsx          # 現有（KPay 用）
├── StripeMethodSelector.tsx       # 新增（Stripe Stage 1：6-row 選擇器）
├── StripePayment.tsx              # 現有（Stripe Stage 2：PaymentElement）
└── KPayPayment.tsx                # 現有（KPay Stage 2：QR/H5）
```

### Stage 1: StripeMethodSelector 設計規格

**視覺設計（深色主題，獨立於 KPay）：**
- 背景：`#0A0D12` (deepest surface from design_sense)
- 卡片：`#0F131C` → `#161D2B` on hover
- 選中狀態：`#1a9d5c` (KPay GREEN) 邊框 + `#22b86b` 發光
- 圓角：`16px`（跟 Stripe PaymentElement 一致）
- 字體：SF Pro Display / system-ui

**6 個方法：**
1. ✅ Card（已開通）
2. ⏳ Alipay（未開通，顯示「即將推出」）
3. ⏳ Alipay 中國內地帳戶（未開通）
4. ⏳ Google Pay（未開通）
5. ⏳ Apple Pay（未開通）
6. ✅ WeChat Pay（已開通）

**互動：**
- 揀咗已開通方法 → 進入 Stage 2（StripePayment）
- 揀咗未開通方法 → Toast 提示「此付款方式即將推出」

### Stage 2: StripePayment 改善

**現有問題（從截圖）：**
1. ❌ Email 輸入框直角（要改圓角）
2. ❌ i18n key 未翻譯（`book.pay_label`、`book.lock_hold_label`）
3. ❌ Powered by Stripe logo 外部連結失效（改用本地 `/logos/stripe-logo.svg`）
4. ✅ Stripe Link widget（keep，唔改）
5. ✅ Appearance API 深色主題（已做，再微調）

**改善項目：**
- PaymentElement 只顯示用戶 Stage 1 揀咗嗰個方法（用 `allowed_payment_method_types`）
- 統一圓角 `16px`
- 修正 i18n keys
- 本地 Stripe logo

---

## 實作步驟

### Step 1: 創建 StripeMethodSelector 組件
- [ ] 新增 `components/checkout/StripeMethodSelector.tsx`
- [ ] 6-row 設計（深色主題，圓角，hover/selected 狀態）
- [ ] 標記已開通 vs 未開通方法
- [ ] Click handler：已開通 → 進入 Stage 2，未開通 → Toast

### Step 2: 修改 book/page.tsx 流程
- [ ] Provider 判斷：
  - `PAYMENT_PROVIDER=kpay` → `PaymentMethodList`（現有）
  - `PAYMENT_PROVIDER=stripe` → `StripeMethodSelector`（新）
- [ ] Stage 2 保持不變（已經係 provider-aware）

### Step 3: 改善 StripePayment 組件
- [ ] Email 輸入框圓角（appearance.rules `.Input` borderRadius）
- [ ] 修正 i18n keys（確認 messages/*.json 有正確 key）
- [ ] Powered by Stripe logo 改本地路徑
- [ ] PaymentElement 只顯示選中方法（`allowed_payment_method_types: [selectedMethod]`）

### Step 4: Stripe Dashboard 開通步驟文檔
- [ ] Web search Stripe Dashboard Payment methods 設定步驟
- [ ] 回報俾用戶手動去開通 Alipay/Google Pay/Apple Pay

### Step 5: 驗證
- [ ] KPay 分支：6-row list 正常顯示（唔受影響）
- [ ] Stripe 分支：新 6-row selector → PaymentElement accordion
- [ ] 截圖對比（改善前 vs 改善後）
- [ ] i18n 全部顯示正確
- [ ] Stripe logo 正常顯示

---

## 未開通方法 API 錯誤處理

即使前端有「即將推出」提示，用戶如果強制發送請求（inspect + 改 code），API 層要有防護：

**`lib/payments/stripe.ts` 現有邏輯：**
```typescript
if (method === 'card') {
  createParams.allowed_payment_method_types = ['card']
} else {
  createParams.automatic_payment_methods = {
    enabled: true,
    allow_redirects: 'never',
  }
}
```

**問題：**
`automatic_payment_methods.enabled = true` 會嘗試開通所有 Dashboard 已啟用嘅方法，但如果用戶揀咗未啟用嘅（e.g. Alipay），Stripe API 會回傳：
```
{
  "error": {
    "code": "payment_method_not_available",
    "message": "Alipay is not enabled for this account"
  }
}
```

**解決方案：**
前端捕捉呢個 error，顯示清晰提示：
```typescript
// StripePayment.tsx PayForm onSubmit
if (error.code === 'payment_method_not_available') {
  setErr('此付款方式暫未開放，請選擇其他方式')
  return
}
```

---

## 需要用戶確認嘅問題

### Q1: Stripe 分支入面，Alipay/Google Pay/Apple Pay 係咪要有獨立入口？

根據要求「六個方法全部要顯示」，方案 A 俾佢哋獨立入口（6-row selector），但用戶揀咗未開通嘅會見到「即將推出」。

**請確認：**
- ✅ 方案 A（兩階段：6-row selector → PaymentElement）
- ❌ 方案 B（單階段：PaymentElement accordion，只顯示已開通方法）

### Q2: StripeMethodSelector 設計方向

要求話「唔係跟 KPay 個六行列表嘅視覺」，但都係 6-row layout。

**視覺差異：**
- KPay: 白色邊框，淺灰背景，綠色選中
- Stripe: 深黑背景（#0A0D12），深灰卡片（#0F131C），圓角 16px，綠色選中 + 發光效果

**請確認：**
- 呢個視覺差異係咪足夠「獨立設計」？
- 定係要完全唔同 layout（例如 3x2 grid 而唔係 6 rows）？

---

## Stripe Dashboard 開通步驟（需要用戶手動操作）

### Alipay
1. Dashboard → Settings → Payment methods
2. 搵到 Alipay → Click "Enable"
3. 填寫 business details（如果係首次啟用）
4. Save

### Google Pay / Apple Pay
1. Dashboard → Settings → Payment methods
2. 搵到 Google Pay / Apple Pay → Click "Enable"
3. 確認 card payment method 已啟用（Google/Apple Pay 依賴 card network）
4. Save

### 注意事項
- **Stripe account 要經過 verification** 先可以啟用某啲方法
- **某啲方法有地區限制**（例如 Alipay 要 business registered in eligible country）
- **測試模式 vs 生產模式**：要分別啟用

---

## 總結

**推薦實作方向：方案 A（兩階段 UI）**

1. KPay: 保持現有 6-row list
2. Stripe: 新設計 6-row selector（Stage 1）→ PaymentElement accordion（Stage 2）
3. 六個方法全部顯示，未開通嘅標記「即將推出」
4. StripePayment 組件改善：圓角、i18n、本地 logo
5. API 層錯誤處理：清晰提示未開通方法

**等待用戶確認：**
- 方案 A vs 方案 B
- StripeMethodSelector 設計方向
- Dashboard 開通步驟（用戶手動操作）

確認後即刻實作。
