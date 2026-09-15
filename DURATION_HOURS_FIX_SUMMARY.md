# duration_hours NOT NULL 違規修正總結

## 🐛 問題根源

### 錯誤訊息
```
[error] [stripe] booking_creation_failed {
  code: '23502',
  message: 'null value in column "duration_hours" of relation "bookings" violates not-null constraint'
}
```

### 觸發時間
2026-09-15 10:35:48，在 `/api/stripe/create-payment-intent` route

### 根本原因

**文件**: `app/api/stripe/create-payment-intent/route.ts`

[Line 45-54](app/api/stripe/create-payment-intent/route.ts#L45-L54) 的 `bookingInserts` 物件**完全冇包含 `duration_hours` 欄位**，但資料庫要求呢個欄位係 NOT NULL。

**問題分析**：
- ✅ Line 8-9: `Block` type 有 `duration` 欄位
- ✅ Line 41: 計算 `totalHours` 時用了 `block.duration`
- ✅ Line 49: 計算 `end_time` 時用了 `block.duration`
- ✅ Line 51: 計算 `total_price` 時用了 `block.duration`
- ❌ **Line 45-54: Insert object 根本冇包含 `duration_hours` 欄位！**

呢個錯誤好可能係當初從舊 code 遷移時，只專注處理 TypeScript 型別要求（例如 `prepareForCheckout()` 的 `isTest`、`durationHours`、`bookingIds` 參數），但漏咗確保實際寫入資料庫嘅 payload 包含所有必需欄位。

---

## ✅ 修正內容

### 修正 `/api/stripe/create-payment-intent`

**文件**: `app/api/stripe/create-payment-intent/route.ts`

**修改前**:
```typescript
const bookingInserts = blocks.map((block) => ({
  user_id: session.user.id,
  date: block.date,
  start_time: `${block.startHour.toString().padStart(2, '0')}:00`,
  end_time: `${(block.startHour + block.duration).toString().padStart(2, '0')}:00`,
  table_number: block.tableNumber,
  total_price: block.duration * hourlyRate,
  status: 'pending',
  payment_provider: 'stripe',
}))
```

**修改後**:
```typescript
const bookingInserts = blocks.map((block) => ({
  user_id: session.user.id,
  date: block.date,
  start_time: `${block.startHour.toString().padStart(2, '0')}:00`,
  end_time: `${(block.startHour + block.duration).toString().padStart(2, '0')}:00`,
  duration_hours: block.duration,           // ✅ 新增
  table_number: block.tableNumber,
  total_price: block.duration * hourlyRate,
  status: 'pending',
  payment_provider: 'stripe',
  payment_method: 'card',                   // ✅ 新增
  is_free_booking: false,                   // ✅ 新增
}))
```

### 添加的欄位

1. **`duration_hours`** (必需): 從 `block.duration` 直接設置
2. **`payment_method`**: 設為 `'card'`（Stripe 預設）
3. **`is_free_booking`**: 設為 `false`（付費訂單）

---

## ✅ 其他 NOT NULL 欄位檢查

### 已檢查的 route

**`/api/payment/create-intent`** (新 slot-based flow):
- ✅ [Line 127-147](app/api/payment/create-intent/route.ts#L127-L147): 完整設置所有必需欄位
- ✅ 包含 `duration_hours: slot.duration_hours`
- ✅ 包含 `is_free_booking: false`
- ✅ 包含 `payment_method: 'card'`
- ✅ 包含 `payment_provider: 'stripe'`

**結論**: 新 flow 冇問題，只有舊的 `/api/stripe/create-payment-intent` 有漏。

---

## ⚠️ Supabase `getSession()` 安全警告

### 警告訊息
```
[warn] Using the user object as returned from supabase.auth.getSession() or from some 
supabase.auth.onAuthStateChange() events could be insecure! ... Use supabase.auth.getUser() instead
```

### 影響範圍

搵到 **9 個 API routes** 使用 `getSession()` 而唔係 `getUser()`：

1. **`app/api/stripe/create-payment-intent/route.ts:17`** ⚠️
2. `app/api/profile/contact-change/verify-new/route.ts:73`
3. `app/api/dev2/env-info/route.ts:11`
4. `app/api/dev2/deploy/route.ts:12`
5. `app/api/dev2/auth-log/route.ts:8`
6. `app/api/dev2/payment-log/route.ts:8`
7. `app/api/dev2/test-price/route.ts:8`
8. `app/api/dev2/git-status/route.ts:12`
9. `app/api/dev2/ip-whitelist/route.ts:8`

### 安全影響

根據 Supabase 官方文件：
- `getSession()` 從本地儲存讀取 session，**唔會驗證 token 是否仍然有效**
- 如果 token 被篡改或過期，`getSession()` 仍然會返回 session object
- `getUser()` 會向 Supabase Auth server 驗證 token，確保用戶身份真實

**建議**: 所有涉及敏感操作的 API routes（特別是 payment 相關）應該用 `getUser()` 而唔係 `getSession()`。

### 優先級

- 🔴 **高優先**: `app/api/stripe/create-payment-intent/route.ts` (付款相關)
- 🟡 **中優先**: `app/api/profile/contact-change/verify-new/route.ts` (個人資料修改)
- 🟢 **低優先**: `app/api/dev2/*` routes (開發工具，已有其他保護機制)

---

## 📋 驗證清單

- [x] 回報 `duration_hours` 個值喺邊一步應該計算返嚟、之前點解漏咗
  - **答**: `block.duration` 已經有值，只係 insert object 漏咗包含 `duration_hours` 欄位
  
- [x] 修正 `bookingInserts` 包含所有必需欄位
  - **完成**: 添加 `duration_hours`, `payment_method`, `is_free_booking`

- [x] 回報有冇搵到其他類似「型別滿足但值缺失」嘅欄位
  - **答**: 同樣漏咗 `payment_method` 和 `is_free_booking`，已一併修正
  - **新 flow** (`/api/payment/create-intent`) 冇問題

- [x] 回報 Supabase `getSession()` warning 嘅出處同影響範圍
  - **答**: 9 個 API routes，其中付款相關的最需要優先修正

- [ ] 一次完整 test 付款，確認 `bookings` 表成功寫入
  - **待用戶測試**: Deploy 後進行真實付款測試

---

## 🚀 下一步

1. **立即 deploy** 修正，避免更多訂單失敗
2. **測試付款流程**，確認 `duration_hours` 正確寫入資料庫
3. **（可選）修正 `getSession()` 安全問題**，改用 `getUser()`（獨立 task）
