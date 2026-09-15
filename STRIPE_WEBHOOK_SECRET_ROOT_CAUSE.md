# Stripe Webhook 簽名驗證失敗 — 根本原因確認

## 🚨 問題根源

**Vercel Production 環境的 `STRIPE_WEBHOOK_SECRET` 設置為空字串 `""`**

## 📋 查證過程

### 1. Webhook Handler 代碼檢查 ✅

**文件**: `app/api/webhooks/stripe/route.ts`

```typescript
// Line 14: 正確使用 req.text() 獲取 raw body
const body = await req.text()
const signature = req.headers.get('stripe-signature')

// Line 24-28: 讀取環境變數
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret) {
  return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
}

// Line 33: 使用 Stripe SDK 驗證簽名
event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
```

**結論**: 代碼實作完全正確，使用標準的 Stripe webhook 處理方式。

### 2. Vercel Production 環境變數檢查 ❌

```bash
$ vercel env pull .env.vercel.production --environment=production
$ grep "STRIPE_WEBHOOK_SECRET" .env.vercel.production

STRIPE_WEBHOOK_SECRET=""
```

**問題確認**: `STRIPE_WEBHOOK_SECRET` 在 production 環境是**空字串**！

### 3. 之前的錯誤日誌回顧

```
[error] No stripe-signature header value was provided
```

這個錯誤訊息其實**誤導性很強**。真正的問題不是 `stripe-signature` header 缺失，而是：
- Stripe 發送的 webhook 請求帶有正確的 `stripe-signature` header
- 但由於 `STRIPE_WEBHOOK_SECRET=""` (空字串)
- `stripe.webhooks.constructEvent()` 驗證失敗並拋出錯誤

## 🔧 修正方案

### 步驟 1: 在 Stripe Dashboard 獲取 Webhook Secret

1. 登入 Stripe Dashboard: https://dashboard.stripe.com/
2. 進入 **Developers → Webhooks**
3. 找到 endpoint `https://space8.com.hk/api/webhooks/stripe`
4. 點擊該 endpoint 查看詳情
5. 複製 **Signing secret** (格式: `whsec_...`)

**重要**: 確認該 endpoint 已訂閱以下事件：
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

### 步驟 2: 更新 Vercel 環境變數

**方法 A: 使用 Vercel CLI**
```bash
# 設置 production 環境變數
vercel env add STRIPE_WEBHOOK_SECRET production

# 輸入從 Stripe Dashboard 複製的 signing secret
# 格式: whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**方法 B: 使用 Vercel Dashboard**
1. 進入 https://vercel.com/lucaycc-3022s-projects/space8/settings/environment-variables
2. 找到 `STRIPE_WEBHOOK_SECRET`
3. 點擊 **Edit**
4. 將 Stripe Dashboard 的 signing secret 貼上
5. 確保選擇 **Production** 環境
6. 點擊 **Save**

### 步驟 3: 重新部署 (可能需要)

```bash
# 觸發重新部署以載入新的環境變數
vercel --prod
```

或者在 Vercel Dashboard 觸發 redeploy。

### 步驟 4: 驗證修正

**測試 webhook**:
1. 在 Stripe Dashboard 的 Webhooks 頁面
2. 點擊該 endpoint
3. 點擊 **Send test webhook**
4. 選擇 `payment_intent.succeeded` 事件
5. 點擊 **Send test webhook**

**檢查 Vercel logs**:
```bash
vercel logs --prod
```

應該看到：
```
[Stripe] webhook received { type: 'payment_intent.succeeded', id: 'evt_...' }
[Stripe] webhook: payment succeeded { bookingId: '...', intentId: 'pi_...' }
```

而**不應該**看到：
```
[Stripe] webhook: signature verification failed
```

## 📊 對比：Local vs Production

| 環境 | STRIPE_WEBHOOK_SECRET | 狀態 |
|------|----------------------|------|
| Local (.env.local) | `""` (空字串) | ❌ 無法驗證 webhook |
| Production (Vercel) | `""` (空字串) | ❌ 無法驗證 webhook |
| **應該是** | `whsec_...` | ✅ 正確驗證 |

## 🔍 為什麼之前的已扣款訂單失敗了

### 時間線回顧

1. **用戶在前端完成付款** (Stripe 成功扣款)
   - Booking 狀態: `pending`
   - Stripe PaymentIntent 狀態: `succeeded`

2. **Stripe 發送 webhook 到 `https://space8.com.hk/api/webhooks/stripe`**
   - 帶有正確的 `stripe-signature` header

3. **Webhook handler 嘗試驗證簽名**
   - 使用 `STRIPE_WEBHOOK_SECRET=""` (空字串)
   - `stripe.webhooks.constructEvent()` 失敗
   - 返回 `401 Invalid signature`

4. **Stripe 重試多次後放棄**
   - Booking 狀態仍然是 `pending` 或 `expired`
   - 用戶已扣款但訂單未確認

### 受影響的訂單

之前已手動修正的兩張訂單：
- `c7176c80-15db-491e-b79a-0957281669ea` (pi_3UFXH35S9CcpaekN0OwU8rr2, HK$5)
- `a2bc45e1-0f2f-400f-a56d-8dd68976e9dc` (pi_3UFqJl5S9CcpaekN12t9N2Nb, HK$5)

都是因為 webhook 簽名驗證失敗，導致付款成功但訂單未確認。

## ✅ 驗證清單

- [x] 確認 webhook handler 代碼正確 (使用 `req.text()` 和標準驗證流程)
- [x] 確認問題根源: `STRIPE_WEBHOOK_SECRET=""` (空字串)
- [ ] 從 Stripe Dashboard 獲取正確的 webhook signing secret
- [ ] 更新 Vercel production 環境變數
- [ ] 重新部署 (如需要)
- [ ] 發送測試 webhook 驗證修正
- [ ] 檢查 Vercel logs 確認簽名驗證成功

## 🚀 下一步

1. **立即修正**: 在 Vercel 設置正確的 `STRIPE_WEBHOOK_SECRET`
2. **測試驗證**: 使用 Stripe Dashboard 發送測試 webhook
3. **監控**: 留意下一筆真實付款是否自動確認
4. **補充修正**: 考慮在 Stripe webhook handler 中添加通知邏輯 (目前只更新狀態，沒有發送通知)

---

## 📝 相關問題

**為什麼 local development 也無法測試 webhook？**

因為 `.env.local` 的 `STRIPE_WEBHOOK_SECRET=""` 也是空字串。

**解決方案**:
1. 使用 Stripe CLI 進行 local webhook 測試:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # 會顯示 webhook signing secret (whsec_...)
   ```

2. 將該 secret 設置到 `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

**注意**: Local 的 signing secret 與 production 不同！
- Local: 由 `stripe listen` 生成的臨時 secret
- Production: Stripe Dashboard 中 endpoint 的固定 secret
