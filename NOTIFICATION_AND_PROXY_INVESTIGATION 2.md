# Space8 通知/發送功能查證報告

## 📋 查證目標

1. 確認 booking 完成後的通知/發送功能實際是什麼
2. 檢查這些功能是否寫死經 KPay endpoint 發送
3. 查證 GoDaddy Server 的防火牆設定和影響範圍
4. 分析與 Stripe webhook 問題的關聯

---

## ✅ 查證結果

### 1. 所有「發送」相關功能清單

#### A. Email 通知
**狀態**: 未實作 (Not Implemented)

- **Route**: `app/api/notifications/email/route.ts`
- **實作**: 返回 `501 Not Implemented`
- **結論**: 系統目前**沒有** email 通知功能

#### B. SMS 通知
**狀態**: 未實作 (Not Implemented)

- **Route**: `app/api/notifications/sms/route.ts`
- **實作**: 返回 `501 Not Implemented`
- **結論**: 系統目前**沒有** SMS 通知功能

#### C. WhatsApp 通知
**狀態**: 已實作，使用獨立 Bot Server

**文件**: `app/api/whatsapp/notify/route.ts`

```typescript
const botUrl = process.env.WHATSAPP_BOT_URL
const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET

// 實際發送
await fetch(`${botUrl}/api/notify/${NOTIFICATION_ENDPOINTS[type]}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-secret": webhookSecret,
  },
  body: JSON.stringify(body),
})
```

**支援的通知類型**:
- `booking-confirmed`: Booking 確認通知
- `reminder`: 提醒通知
- `session-ending`: Session 結束通知

**結論**: WhatsApp 通知**不經 KPay**，直接連接到獨立的 `WHATSAPP_BOT_URL`

#### D. WhatsApp OTP
**狀態**: 已實作，使用獨立 Bot Server

**文件**: `app/api/whatsapp/send-otp/route.ts`

```typescript
await fetch(`${botUrl}/api/send-otp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-secret": webhookSecret,
  },
  body: JSON.stringify({ phone }),
})
```

**結論**: WhatsApp OTP **不經 KPay**，直接連接到獨立的 `WHATSAPP_BOT_URL`

---

### 2. KPay Proxy Server 分析

#### A. KPay Proxy 的作用

**文件**: `lib/kpay/proxyFetch.ts`

```typescript
export async function kpayProxyFetch(
  targetUrl: string,
  options: RequestInit = {},
): Promise<Response> {
  const proxyBase = process.env.KPAY_PROXY_URL
  const proxyAuth = process.env.KPAY_PROXY_AUTH_TOKEN

  return await fetch(proxyBase, {
    ...options,
    headers: {
      ...options.headers,
      'X-Target-Url': targetUrl,
      'X-Proxy-Auth': proxyAuth,
    },
  })
}
```

**重要發現**:
- KPay Proxy 是一個**出站 (outbound) 專用 proxy**
- 只用於 Space8 → KPay 的 API 請求
- **不處理入站 (inbound) webhook 請求**

#### B. KPay Proxy 的使用範圍

**只用於以下場景**:
1. 建立 KPay 訂單 (`/v1/order/add`, `/v1/qr/sales/*`)
2. 查詢 KPay 訂單狀態 (`/v1/order/sales/result`)
3. KPay 退款 (`/v1/refund`)

**環境變數**:
```
KPAY_PROXY_URL="https://kpay-proxy.space8.com.hk/"
KPAY_PROXY_AUTH_TOKEN=<token>
```

**結論**: KPay Proxy 是 **outbound-only**，**不影響 Stripe webhook 的 inbound 請求**

---

### 3. Booking 確認後的通知邏輯

#### A. KPay Webhook Handler

**文件**: `app/api/webhooks/kpay/route.ts`

當 KPay 付款成功後，webhook handler 會：

```typescript
// Line 414-416: 插入 notification_log 記錄
await supabase.from('notification_log').insert([
  { 
    user_id: result.user_id, 
    booking_id: result.booking_id, 
    channel: 'email', 
    type: 'booking_confirmed', 
    status: 'sent' 
  },
  { 
    user_id: result.user_id, 
    booking_id: result.booking_id, 
    channel: 'whatsapp', 
    type: 'booking_confirmed', 
    status: 'pending' 
  },
])
```

**重要**: 這只是**記錄通知狀態**，**不是實際發送通知**。實際的 WhatsApp 通知發送需要呼叫 `app/api/whatsapp/notify/route.ts`。

#### B. Stripe Webhook Handler

**文件**: `app/api/webhooks/stripe/route.ts`

當 Stripe 付款成功後，webhook handler **只更新 booking 狀態**：

```typescript
// Line 101-108: 只更新資料庫
const { error } = await supabase
  .from('bookings')
  .update({
    status: 'confirmed',
    payment_provider: 'stripe',
    provider_order_no: intent.id,
    stripe_payment_intent: intent.id,
  })
  .eq('id', bookingId)
```

**重要發現**: Stripe webhook handler **完全沒有發送通知的邏輯**，連 `notification_log` 都沒插入！

**對比**:
- ✅ KPay webhook: 插入 `notification_log` (但未實際發送)
- ❌ Stripe webhook: 完全沒有通知邏輯

#### C. Database Functions

**文件**: `supabase/migrations/20260831_numeric_amount_fix.sql`

`confirm_booking()` 和 `confirm_booking_group()` 函數**不包含任何通知發送邏輯**，只處理：
- 更新 booking 狀態
- 更新 slot 狀態
- 計算並發放積分
- 處理折扣

**結論**: **目前系統沒有自動發送 booking 確認通知**（無論 KPay 或 Stripe）

---

### 4. GoDaddy Server / Proxy 防火牆設定查證

#### A. 查證結果

**找到的證據**:
1. **環境變數存在 KPay Proxy**:
   ```
   KPAY_PROXY_URL="https://kpay-proxy.space8.com.hk/"
   KPAY_PROXY_AUTH_TOKEN=<token>
   ```

2. **Proxy 只用於 outbound KPay API 請求**

3. **沒有找到 GoDaddy Server 的防火牆配置文件**

#### B. 推測的架構

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                           │
└─────────────────────────────────────────────────────────┘
           │                                    │
           │ Inbound Webhooks                  │ Outbound API
           │ (Stripe/KPay → Space8)            │ (Space8 → KPay)
           ▼                                    ▼
    ┌──────────────┐                   ┌──────────────────┐
    │   Vercel     │                   │  KPay Proxy      │
    │ space8.com.hk│────────────────→  │ kpay-proxy.      │
    └──────────────┘                   │ space8.com.hk    │
                                       └──────────────────┘
                                              │
                                              ▼
                                       ┌──────────────────┐
                                       │   KPay API       │
                                       │ payment.kpay-    │
                                       │ group.com        │
                                       └──────────────────┘
```

**重要**: 
- Stripe webhook 直接連接到 Vercel (`space8.com.hk/api/webhooks/stripe`)
- **不經過 KPay Proxy Server**
- KPay Proxy 只處理 Space8 → KPay 的 outbound 請求

#### C. 防火牆影響範圍

**如果 KPay Proxy Server 有防火牆限制**:

✅ **不影響**:
- Stripe webhook (inbound, 不經過 proxy)
- KPay webhook (inbound, 不經過 proxy)
- WhatsApp 通知 (outbound, 直連 `WHATSAPP_BOT_URL`)

❌ **會影響**:
- Space8 → KPay API 請求 (建單、查詢、退款)

**結論**: 即使 KPay Proxy Server 有嚴格的防火牆設定，**也不會影響 Stripe webhook 的接收**

---

### 5. 對 Stripe Webhook 問題的關聯分析

#### 之前的 Stripe Webhook 錯誤

```
[error] No stripe-signature header value was provided
```

#### 可能原因分析

**❌ 排除**: 
- **不是 GoDaddy Server 防火牆問題** — Stripe webhook 不經過 KPay Proxy
- **不是 proxy 改寫 header** — inbound webhook 不走 proxy

**✅ 更可能的原因**:
1. **Stripe Dashboard Webhook 配置錯誤**:
   - Webhook endpoint URL 設定錯誤
   - Webhook signing secret 未正確設置

2. **Vercel 部署問題**:
   - 環境變數 `STRIPE_WEBHOOK_SECRET` 未正確設置
   - Route 配置問題

3. **測試環境混淆**:
   - 使用 test mode secret 但接收 live mode webhook
   - 或相反

#### 驗證步驟

1. **檢查 Stripe Dashboard**:
   - Webhook endpoint: `https://space8.com.hk/api/webhooks/stripe`
   - 確認 signing secret 已複製到 Vercel 環境變數

2. **檢查 Vercel 環境變數**:
   ```bash
   vercel env ls | grep STRIPE
   ```
   應該有:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

3. **測試 webhook 接收**:
   - 使用 Stripe Dashboard 的「Send test webhook」功能
   - 檢查 Vercel logs 確認請求到達

---

## 📊 總結

### 通知功能現狀

| 功能 | 狀態 | 實作方式 | 是否經 KPay |
|------|------|----------|-------------|
| Email 通知 | ❌ 未實作 | N/A | N/A |
| SMS 通知 | ❌ 未實作 | N/A | N/A |
| WhatsApp 通知 | ✅ 已實作 | 直連 Bot Server | ❌ 否 |
| WhatsApp OTP | ✅ 已實作 | 直連 Bot Server | ❌ 否 |
| Booking 確認通知 | ❌ 未自動發送 | 僅記錄 log | N/A |

### KPay Proxy 影響範圍

| 請求類型 | 是否經過 Proxy | 影響 |
|----------|---------------|------|
| Space8 → KPay API | ✅ 是 | 若 proxy 故障會影響 KPay 付款 |
| Stripe → Space8 Webhook | ❌ 否 | **不受 proxy 影響** |
| KPay → Space8 Webhook | ❌ 否 | **不受 proxy 影響** |
| Space8 → WhatsApp Bot | ❌ 否 | **不受 proxy 影響** |

### GoDaddy Server / 防火牆

**結論**: 
- ✅ 確認存在 KPay Proxy Server (`kpay-proxy.space8.com.hk`)
- ✅ Proxy 只處理 outbound KPay API 請求
- ✅ **Stripe webhook 不經過此 proxy**
- ❌ 未找到防火牆配置文件（可能在 proxy server 本身的配置中）

**Stripe webhook 問題的根本原因**:
- **與 GoDaddy Server / KPay Proxy 無關**
- 應該檢查 Stripe Dashboard 的 webhook 配置和 signing secret

---

## 🔍 待確認事項

1. **Booking 確認通知未自動發送**:
   - KPay 付款: 只記錄 `notification_log`，未實際呼叫 WhatsApp API
   - Stripe 付款: 連 `notification_log` 都沒記錄
   - **建議**: 需要在 webhook handler 中添加實際的通知發送邏輯

2. **Stripe Webhook 配置**:
   - 用戶需要在 Stripe Dashboard 檢查 webhook endpoint 和 signing secret
   - 重新發送測試 webhook 驗證配置正確

3. **WhatsApp Bot Server**:
   - 環境變數 `WHATSAPP_BOT_URL` 的實際值
   - Bot server 是否運作正常

4. **KPay Proxy Server 防火牆**:
   - 雖然不影響 Stripe webhook，但需要確認是否影響 KPay API 請求
   - 若需修改 allowlist，應該包含 KPay API domain (`payment.kpay-group.com`, `payment.uat.kpay-group.com`)
