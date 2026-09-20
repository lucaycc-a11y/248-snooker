# Stripe 複製 KPay Workflow 結構 — 完整對比與實作計劃

## 任務目標
將 Stripe 付款流程改為與 KPay 完全一致的兩階段結構，只替換底層 API 呼叫，UI 結構和互動邏輯保持一致。

---

## 1. KPay 現有 Workflow 結構

### 1.1 檔案清單
- **`app/[locale]/book/page.tsx`** (lines 1939, 2387-2462)
  - 控制兩階段切換的主邏輯
  - `confirmed` 狀態控制 Stage 1 ↔ Stage 2
  
- **`components/checkout/PaymentMethodList.tsx`** (lines 165-224)
  - Stage 1: 付款方式選擇器
  - 支援 provider 切換（STRIPE_METHODS vs KPAY_METHODS）
  
- **`components/checkout/KPayPayment.tsx`** (lines 1-1400+)
  - Stage 2: 付款執行組件
  - 處理 QR + redirect 兩種流程
  - 包含完整的狀態機、輪詢、倒數、錯誤處理

### 1.2 兩階段流程

#### Stage 1: 選擇付款方式 (`!confirmed`)
```tsx
// book/page.tsx lines 2387-2402
!confirmed ? (
  <PaymentMethodList
    selected={paymentMethod}
    onSelect={(method) => {
      setPaymentError(null)
      setPaymentMethod(method)
      // 設定 KPay 相關狀態
      setKpayMethod(method as KPayMethod)
      setKpayMode(isDesktopDevice() ? "qr" : "h5")
    }}
  />
)
```

**UI 呈現:**
- 顯示所有可用付款方式的卡片列表
- 每張卡片有 radio、icon、label、sublabel
- 用戶點擊選擇一個方式
- 滾動到 "確認" 按鈕位置
- **此時尚未執行付款，只是選擇**

#### Stage 2: 執行付款 (`confirmed`)
```tsx
// book/page.tsx lines 2403-2461
confirmed && paymentMethod !== null ? (
  <KPayPayment
    blocks={blocks}
    method={kpayMethod}
    mode={kpayMode}
    labels={{...}}
    onBackToMethods={() => {
      clearKPayPersistedState()
      setConfirmed(false)
      setPaymentMethod(null)
    }}
    onSuccess={(bookingId) => {
      window.location.href = `/book?bookingId=${bookingId}&redirect_status=returned`
    }}
  />
)
```

**UI 呈現:**
- 顯示 KPayPayment 組件
- 內部根據 server 回應的 `kind` 決定：
  - **kind='redirect'**: 直接 `window.location.href = json.payInfo` 跳轉到 CNP Hosted
  - **kind='qr'**: 顯示 QR code + 倒數 + 輪詢狀態

### 1.3 KPayPayment 內部邏輯

#### 關鍵狀態
```tsx
// KPayPayment.tsx lines 12-20
type KPayState =
  | 'idle'          // 初始狀態
  | 'pending'       // QR/H5 顯示中，等待付款
  | 'pending_confirmation' // provider 成功，等待 DB 確認
  | 'success'       // 付款確認成功
  | 'failed'        // 付款失敗
  | 'cancelled'     // 訂單取消
  | 'expired'       // QR 過期
  | 'unauthorized'  // session 過期
```

#### Redirect Flow (Card)
```tsx
// KPayPayment.tsx lines 387-409
if ((json.kind === 'redirect' || json.kind === 'link') && json.payInfo) {
  // 1. 驗證 URL 格式
  if (!/^(https?:\/\/|[a-z][a-z0-9+.-]*:)/i.test(json.payInfo.trim())) {
    setError('付款閘道回應格式錯誤')
    setState('failed')
    return
  }
  
  // 2. 更新 URL 為 /book/confirm
  const confirmUrl = `${origin}/${locale}/book/confirm?bookingId=${bookingId}`
  window.history.replaceState({}, '', confirmUrl)
  
  // 3. 保存狀態到 sessionStorage
  persistKPayState({ bookingId, providerOrderNo, method, mode, ... })
  
  // 4. 直接跳轉到 KPay Hosted 頁面
  window.location.href = json.payInfo
}
```

**關鍵點:** 
- **不渲染任何 UI**，直接跳轉
- 跳轉前先保存狀態，用於返回後恢復

#### QR Flow (FPS, PayMe, Alipay 等)
```tsx
// KPayPayment.tsx lines 1036-1148
if (kind === 'qr' && payInfo) {
  return (
    <div style={styles.card}>
      {/* QR Title */}
      <p style={styles.qrTitle}>
        {labels.pending.replace('{method}', METHOD_NAMES[method])}
      </p>

      {/* QR Code */}
      <div style={styles.qrWrap}>
        <QRCodeSVG
          value={payInfo}
          size={220}
          bgColor={BG}
          fgColor={TEXT}
          level="L"
          includeMargin
        />
      </div>

      {/* Countdown */}
      <p style={styles.countdownText}>
        {labels.countdown.replace('{time}', formatCountdown(countdown))}
      </p>

      {/* Elapsed time */}
      {elapsedSec > 0 && (
        <p style={styles.elapsedText}>
          {labels.waited.replace('{seconds}', String(elapsedSec))}
        </p>
      )}

      {/* Progress bar */}
      <div style={styles.countdownBarBg}>
        <div style={{
          ...styles.countdownBarFill,
          transform: `scaleX(${countdown / expiresIn})`,
          background: isUrgent ? DANGER : GREEN_BRIGHT,
        }} />
      </div>

      {/* Help text + WhatsApp */}
      <p style={styles.helpText}>...</p>

      {/* Back button */}
      <button onClick={onBackToMethods}>返回付款方式</button>

      {/* Cancel button */}
      <button onClick={handleCancel}>取消預訂</button>
    </div>
  )
}
```

#### 輪詢機制
```tsx
// KPayPayment.tsx lines 220-229
const KPAY_POLL_FAST_MS = 2_000      // 前 30 秒每 2 秒輪詢
const KPAY_POLL_SLOW_MS = 5_000      // 之後每 5 秒輪詢
const KPAY_POLL_FAST_PHASE_MS = 30_000
const KPAY_POLL_TIMEOUT_MS = 60_000  // 60 秒後停止輪詢

// 輪詢邏輯: 檢查 booking 的 status
// - 'confirmed' → setState('success'), onSuccess(bookingId)
// - 'pending' → 繼續輪詢
// - 其他 → setState('failed')
```

---

## 2. Stripe 現有結構

### 2.1 檔案清單
- **`components/checkout/StripeMethodSelector.tsx`**
  - 單階段組件：選擇器 + inline expansion
  - 選擇方式後，下方直接展開付款表單
  - CardPaymentForm (PaymentElement) vs QRCodeUI

### 2.2 現有流程（單階段 inline）

```tsx
// StripeMethodSelector.tsx lines 725-856
return (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {METHODS.map((method) => {
      const isSelected = selected === method.id
      const isExpanded = isSelected && method.enabled

      return (
        <div key={method.id}>
          {/* Method card */}
          <button onClick={() => handleSelect(method)}>
            {/* Radio + Icon + Label */}
          </button>

          {/* Inline expansion */}
          {isExpanded && clientSecret && bookingId && (
            <div style={{
              marginTop: -8,
              padding: "24px 20px 20px",
              background: "#0A0D12",
              borderBottomLeftRadius: 16,
              ...
            }}>
              <Elements stripe={stripePromise} options={{...}}>
                {selectedMethod.type === 'card' ? (
                  <CardPaymentForm {...} />
                ) : (
                  <QRCodeUI {...} />
                )}
              </Elements>
            </div>
          )}
        </div>
      )
    })}
  </div>
)
```

**問題:**
- 選擇器和付款表單在同一個組件內
- 用戶選擇後立即 inline 展開表單
- 與 KPay 的兩階段分離結構不一致

---

## 3. 結構差異對比表

| 層面 | KPay | Stripe 現有 | 目標 Stripe (新) |
|------|------|-------------|-----------------|
| **階段數** | 兩階段 | 單階段 | 兩階段 |
| **Stage 1** | PaymentMethodList | StripeMethodSelector (選擇器部分) | PaymentMethodList (複用) |
| **Stage 2** | KPayPayment | StripeMethodSelector (展開的表單) | StripePayment (新建) |
| **狀態控制** | `confirmed` boolean | `selected` + `isExpanded` | `confirmed` boolean |
| **UI 切換** | 完全替換組件 | inline 展開/收合 | 完全替換組件 |
| **Card 處理** | Redirect 到 CNP Hosted | inline PaymentElement | 顯示 PaymentElement (不跳轉) |
| **QR 處理** | QR code + 輪詢 | QR code (無輪詢) | QR code + 輪詢 |
| **返回按鈕** | onBackToMethods → setConfirmed(false) | 無 | onBackToMethods → setConfirmed(false) |
| **狀態持久化** | sessionStorage | 無 | sessionStorage |

---

## 4. 實作計劃

### Phase 1: 建立 StripePayment 組件 (仿 KPayPayment)

**新檔案:** `components/checkout/StripePayment.tsx`

**Props 定義:**
```tsx
type StripePaymentMethod = 'card' | 'wechat_pay' | 'alipay' | 'google_pay' | 'apple_pay'

type StripeBlock = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

type StripeLabels = {
  title: string
  pending: string
  pending_desc: string
  pending_confirmation: string
  pending_confirmation_desc: string
  success: string
  success_desc: string
  failed: string
  failed_desc: string
  expired: string
  expired_desc: string
  regenerate: string
  try_again: string
  countdown: string
  help: string
  support_whatsapp: string
  back_to_methods: string
  waited: string
  cancelled: string
  cancelled_desc: string
  cancel: string
  processing: string
  terms_required: string
}

type Props = {
  blocks: StripeBlock[]
  method: StripePaymentMethod
  labels: StripeLabels
  agreedToTerms: boolean
  returnUrl: string
  onBackToMethods: () => void
  onSuccess: (bookingId?: string) => void
}
```

**核心邏輯:**
1. **Card 方式:** 
   - 顯示 Stripe PaymentElement
   - 用戶填寫卡號、到期日、CVC
   - 點擊 "Pay" 按鈕
   - `stripe.confirmPayment()` → 跳轉到 returnUrl

2. **QR 方式 (WeChat Pay):**
   - 呼叫 `/api/stripe/create-payment-intent`
   - `stripe.confirmWechatPayPayment()` 取得 QR code
   - 顯示 QR code + 倒數 + 輪詢
   - 輪詢邏輯：檢查 booking.status
   - 成功 → onSuccess(bookingId)

3. **狀態機:**
```tsx
type StripeState =
  | 'idle'
  | 'pending'
  | 'pending_confirmation'
  | 'success'
  | 'failed'
  | 'expired'
```

4. **UI 結構:**
```tsx
// Card flow
if (method === 'card') {
  return (
    <div style={styles.card}>
      <Elements stripe={stripePromise} options={{...}}>
        <PaymentElement />
        <button onClick={handleCardPayment}>
          Pay · HK${amount}
        </button>
        <button onClick={onBackToMethods}>
          返回付款方式
        </button>
      </Elements>
    </div>
  )
}

// QR flow
if (method === 'wechat_pay' && qrUrl) {
  return (
    <div style={styles.card}>
      <p style={styles.qrTitle}>
        {labels.pending.replace('{method}', '微信支付')}
      </p>
      <div style={styles.qrWrap}>
        <img src={qrUrl} style={{ width: 220, height: 220 }} />
      </div>
      <p style={styles.countdownText}>
        {labels.countdown.replace('{time}', formatCountdown(countdown))}
      </p>
      {/* Progress bar, help text, buttons */}
    </div>
  )
}
```

### Phase 2: 修改 book/page.tsx 切換邏輯

**目標:** 將 Stripe 改為與 KPay 相同的兩階段流程

**Before (現有):**
```tsx
provider === 'stripe' && (
  <StripeMethodSelector
    blocks={blocks}
    method={paymentMethod}
    returnUrl={returnUrl}
    {...otherProps}
  />
)
```

**After (新):**
```tsx
provider === 'stripe' && !confirmed ? (
  <PaymentMethodList
    selected={paymentMethod}
    onSelect={(method) => {
      setPaymentError(null)
      setPaymentMethod(method)
      scrollIntoViewIfNeeded(payCtaRef)
    }}
  />
) : provider === 'stripe' && confirmed && paymentMethod !== null ? (
  <>
    <StripePayment
      blocks={blocks.map((b) => ({
        date: b.date,
        startHour: b.startHour,
        duration: b.duration,
        tableNumber: b.tableNumber as 1 | 2,
      }))}
      method={paymentMethod as StripePaymentMethod}
      labels={{
        title: t("stripe_title"),
        pending: t("stripe_qr_scan") || `請用微信支付掃描以下二維碼`,
        pending_desc: t("stripe_pending_desc") || "請在手機上完成付款",
        success: t("stripe_success") || "付款成功",
        success_desc: t("stripe_success_desc") || "你的預訂已確認",
        failed: t("stripe_failed") || "付款失敗",
        failed_desc: t("stripe_failed_desc") || "交易未能完成",
        // ... 其他 labels
      }}
      returnUrl={returnUrl}
      agreedToTerms={agreedToTerms}
      onBackToMethods={() => {
        clearStripePersistedState()
        setConfirmed(false)
        setPaymentMethod(null)
      }}
      onSuccess={(bookingId) => {
        if (bookingId) {
          window.location.href = `/book?bookingId=${bookingId}&redirect_status=returned`
        }
      }}
    />
    {/* Powered by Stripe */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14, opacity: 0.5 }}>
      <img src="/logos/stripe-logo.svg" alt="Powered by Stripe" style={{ height: 18, width: "auto" }} />
    </div>
  </>
)
```

### Phase 3: PaymentMethodList 支援 Stripe

**檔案:** `components/checkout/PaymentMethodList.tsx`

**已有的 provider 切換邏輯 (lines 165-175):**
```tsx
const provider = process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'kpay'
const STRIPE_METHODS = ['card', 'alipay', 'google_pay', 'apple_pay', 'wechat_pay']
const KPAY_METHODS = ['card', 'fps', 'payme', 'octopus', 'alipay', 'alipayhk', 'wechat', 'unionpay_qp']

const methods = provider === 'stripe' ? STRIPE_METHODS : KPAY_METHODS
```

**動作:** 無需修改，已經支援 Stripe

### Phase 4: 狀態持久化 (sessionStorage)

**新增 helper functions:**
```tsx
// lib/payments/stripe-persistence.ts
const STRIPE_SESSION_KEY = 'stripePayment'

type StripePersistedState = {
  bookingId: string
  clientSecret: string
  method: string
  agreedToTerms: boolean
  savedAt: number
}

export function persistStripeState(state: StripePersistedState) {
  try {
    sessionStorage.setItem(STRIPE_SESSION_KEY, JSON.stringify(state))
  } catch {}
}

export function getPersistedStripeState(): StripePersistedState | null {
  try {
    const raw = sessionStorage.getItem(STRIPE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // 30 min expiry
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(STRIPE_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearStripePersistedState() {
  try {
    sessionStorage.removeItem(STRIPE_SESSION_KEY)
  } catch {}
}
```

**使用:**
- Card flow: 在 `confirmPayment` 前保存
- QR flow: 在建立 PaymentIntent 後保存
- 頁面刷新: book/page.tsx 讀取並恢復狀態

---

## 5. 驗證步驟

### 5.1 結構報告
```bash
# 列出所有相關檔案
- components/checkout/StripePayment.tsx (新建)
- components/checkout/PaymentMethodList.tsx (已支援 Stripe)
- app/[locale]/book/page.tsx (修改 Stripe 切換邏輯)
- lib/payments/stripe-persistence.ts (新建)
```

### 5.2 截圖驗證
1. **Stage 1 - 選擇器畫面**
   - 顯示所有 Stripe 付款方式
   - Card、WeChat Pay、Alipay (disabled)
   - Radio 選擇 UI

2. **Stage 2 - Card 畫面**
   - PaymentElement (卡號、到期日、CVC 輸入欄)
   - "Pay · HK$XXX" 按鈕
   - "返回付款方式" 按鈕
   - **不可同時看到 QR code**

3. **Stage 2 - QR 畫面**
   - WeChat Pay QR code
   - 倒數計時
   - 進度條
   - Help text + WhatsApp 連結
   - "返回付款方式" 按鈕
   - "取消預訂" 按鈕
   - **不可同時看到 PaymentElement**

### 5.3 功能測試
1. **Card 付款完整流程**
   - Stage 1: 選擇 "信用卡"
   - 點擊 "確認" (或 CTA 按鈕) → 進入 Stage 2
   - 填寫測試卡號 `4242 4242 4242 4242`
   - 點擊 "Pay" → 跳轉到 returnUrl → 顯示成功畫面

2. **WeChat Pay QR 完整流程**
   - Stage 1: 選擇 "微信支付"
   - 點擊 "確認" → 進入 Stage 2
   - 看到 QR code + 倒數
   - (測試環境) 模擬付款成功
   - 輪詢檢測到 confirmed → 跳轉成功頁

3. **返回按鈕**
   - 在 Stage 2 點擊 "返回付款方式"
   - 回到 Stage 1 選擇器
   - 之前的選擇被清除
   - 可以重新選擇

4. **頁面刷新恢復**
   - 在 QR 顯示中刷新頁面
   - 自動恢復到 Stage 2 QR 畫面
   - 繼續輪詢狀態

---

## 6. 關鍵設計決定

### 6.1 為什麼完全複製 KPay 結構？
- **一致性:** 用戶體驗在兩個 provider 之間保持一致
- **可維護性:** 相同的狀態機、相同的 UI 模式
- **可測試性:** 相同的測試流程和驗證步驟

### 6.2 Card 是否需要 redirect？
**答:** 否

- KPay card 需要 redirect 到 CNP Hosted (第三方頁面)
- Stripe card 使用 PaymentElement，可以 inline 完成
- 但為了結構一致性，仍然放在獨立的 Stage 2 組件中

### 6.3 QR 輪詢的實作方式
**答:** 與 KPay 完全相同

- 前 30 秒: 每 2 秒輪詢一次
- 30 秒後: 每 5 秒輪詢一次
- 60 秒後: 停止輪詢，顯示 "檢查中" 狀態
- 輪詢 endpoint: `GET /api/bookings/${bookingId}`
- 檢查 `booking.status === 'confirmed'`

### 6.4 sessionStorage 的用途
**答:** 頁面刷新恢復

- 用戶在付款過程中刷新頁面
- 從 sessionStorage 讀取 bookingId + clientSecret
- 恢復到相同的付款狀態
- 繼續輪詢（QR）或重新顯示表單（Card）

---

## 7. 排除範圍

**不包含在此次任務:**
- Admin dashboard 修改
- Hero section 修改
- 其他未完成的 feature
- KPay 組件的任何修改（絕對不可碰）
- PaymentMethodList 的任何修改（除非發現 bug）

**只專注:**
- 建立 StripePayment 組件
- 修改 book/page.tsx 的 Stripe 邏輯
- 建立 stripe-persistence.ts
- 驗證兩階段流程正確運作

---

## 8. 成功標準

✅ **結構一致:** Stripe 使用與 KPay 相同的兩階段流程
✅ **UI 互斥:** Card 畫面和 QR 畫面完全獨立，不可同時顯示
✅ **功能完整:** Card 和 WeChat Pay 都能完成完整付款流程
✅ **狀態持久:** 頁面刷新後能正確恢復付款狀態
✅ **無破壞:** KPay 流程完全不受影響

---

## 9. 下一步動作

1. ✅ 完成此對比文件
2. ⏳ 建立 `components/checkout/StripePayment.tsx`
3. ⏳ 建立 `lib/payments/stripe-persistence.ts`
4. ⏳ 修改 `app/[locale]/book/page.tsx` Stripe 邏輯
5. ⏳ 本地測試 Card 流程
6. ⏳ 本地測試 WeChat Pay QR 流程
7. ⏳ 截圖驗證
8. ⏳ Push to main + Vercel 驗證
