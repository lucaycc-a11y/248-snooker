# Phase A: `/api/member/bookings` 500 錯誤診斷報告

**日期**: 2026-09-25  
**狀態**: ROOT CAUSE IDENTIFIED — 等待修復方案確認

---

## 錯誤症狀

- **Endpoint**: `/api/member/bookings`
- **狀態碼**: 500 Internal Server Error
- **錯誤訊息**: 無 (空白)
- **執行時間**: 360ms
- **前置條件**: Middleware 200 OK, `getUser()` 成功驗證

---

## 根本原因 (ROOT CAUSE)

**Column name mismatch between API query and actual database schema.**

### 證據 1: Member API 查詢的欄位 (錯誤)

檔案: [app/api/member/bookings/route.ts:25](app/api/member/bookings/route.ts#L25)

```typescript
.select('id, table_id, date, start_time, duration_hours, price, human_code, status')
```

查詢欄位:
- `table_id` ❌
- `price` ❌
- `duration_hours` ✓
- `human_code` ✓

### 證據 2: 實際 production schema (正確)

檔案: [app/api/booking/status/route.ts:30](app/api/booking/status/route.ts#L30)  
檔案: [lib/data/getAdminBookings.ts:92](lib/data/getAdminBookings.ts#L92)

實際欄位名稱:
- `table_number` ✓ (NOT `table_id`)
- `total_price` ✓ (NOT `price`)
- `duration_hours` ✓
- `human_code` ✓ (added via migration 0030, nullable)

### 證據 3: Schema 不一致的歷史原因

Migration [0003_booking_security_foundation.sql](supabase/migrations/0003_booking_security_foundation.sql) 註解明確指出:

> "written against the LIVE column names of the existing public.bookings / public.slots tables... which are not defined in this repo"

`bookings` 表是在 migration 系統之外建立的,部分 API 使用了錯誤的欄位名稱。

---

## 錯誤傳播路徑

1. User 請求 `/api/member/bookings`
2. Middleware 通過 (200)
3. `getUser()` 驗證成功
4. Supabase query 執行:
   ```typescript
   supabase.from('bookings').select('id, table_id, ..., price, ...')
   ```
5. **Supabase 返回錯誤**: `column "table_id" does not exist`, `column "price" does not exist`
6. Error handler (line 29-31) 捕獲錯誤
7. 返回 `{ error: error.message }` with status 500
8. 但錯誤訊息在 production logs 中未顯示 (可能被 Vercel 或 middleware 吞掉)

---

## 影響範圍

### 受影響
- ✅ `/api/member/bookings` (production 已壞)
- ❓ 任何其他使用 `table_id` 或 `price` 查詢 bookings 表的 API

### 未受影響
- ✅ `/api/booking/status` (使用正確欄位名稱)
- ✅ Admin bookings API (使用正確欄位名稱)
- ✅ Checkout/create APIs (使用 INSERT 不受影響)

---

## 修復方案 (待確認)

### 選項 A: 修正欄位名稱 (推薦)

**檔案**: [app/api/member/bookings/route.ts](app/api/member/bookings/route.ts)

**修改**:
```diff
  const { data: bookings, error } = await supabase
    .from('bookings')
-   .select('id, table_id, date, start_time, duration_hours, price, human_code, status')
+   .select('id, table_number, date, start_time, duration_hours, total_price, human_code, status')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
```

**Response mapping 修改**:
```diff
  return NextResponse.json({
    bookings: (bookings ?? []).map((b) => ({
      id: b.id,
-     tableId: b.table_id,
+     tableId: b.table_number,
      date: b.date,
      startTime: b.start_time,
      durationHours: b.duration_hours,
-     price: b.price,
+     price: b.total_price,
      humanCode: b.human_code,
      status: b.status,
    })),
  })
```

**優點**:
- 直接修復根本原因
- 與其他 API (admin, booking/status) 保持一致
- 最小改動,風險低

**缺點**:
- 需確認前端是否依賴 response 的 `tableId` 和 `price` key (應該沒問題,只是 camelCase 轉換)

### 選項 B: 增強錯誤處理 (額外改進)

在修復欄位名稱的同時,加入更好的錯誤日誌:

```typescript
if (error) {
  console.error('[member/bookings] Query failed:', {
    userId: user.id,
    error: error.message,
    code: error.code,
  })
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

**優點**:
- 未來類似錯誤更容易診斷
- 符合其他 API 的錯誤處理模式

---

## 驗證計劃

修復後需確認:

1. **本機測試**:
   ```bash
   npm run dev
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/member/bookings
   ```
   預期: 返回 200 with bookings array

2. **UAT 部署測試**:
   - 部署到 UAT
   - 使用真實會員帳號測試
   - 確認返回資料格式正確

3. **Production 部署**:
   - 經 UAT 驗證通過後
   - 取得明確批准
   - 部署到 main/production

---

## 下一步

等待你的確認:
1. ✅ 修復方案是否正確?
2. ✅ 是否同時加入錯誤日誌改進?
3. ✅ 確認後即可在 `feat/dashboard-fix-redesign` 分支實作
