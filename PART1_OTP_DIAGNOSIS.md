# Part 1 — OTP 驗證失敗診斷報告

## 實測 Log 證據

```
04:46:03  POST /otp     → 200 成功   auth_event: "user_recovery_requested"
04:46:27  POST /verify  → 403 失敗   error: "token has expired or is invalid"
                                       error_code: "otp_expired"
```

## 診斷結果

### 問題根源分析

經過詳細檢查所有代碼路徑，發現**現有登入 OTP 代碼本身是正確的**：

1. **Email OTP 發送** ([app/api/auth/send-email-otp/route.ts:31-34](app/api/auth/send-email-otp/route.ts#L31-L34))
   ```typescript
   const { error } = await supabase.auth.signInWithOtp({
     email,
     options: { shouldCreateUser: false },
   })
   ```
   ✓ 使用 `signInWithOtp` — 正確的登入 API
   ✓ 不傳 `type` 參數時，Supabase 默認使用 `type: "email"` for email OTP

2. **Email OTP 驗證** ([components/auth/AuthCard.tsx:599](components/auth/AuthCard.tsx#L599))
   ```typescript
   const { error } = await supabase.auth.verifyOtp({ 
     email: email.trim(), 
     token: code, 
     type: "email" 
   })
   ```
   ✓ 明確使用 `type: "email"` — 與發送時一致

3. **Phone OTP 路徑** ([app/api/otp/send/route.ts](app/api/otp/send/route.ts))
   - 使用 Engagelab 發送 SMS，不經過 Supabase Auth 的 `signInWithOtp`
   - 驗證時通過 `/api/otp/verify` 換取 `token_hash`，再用 `type: "magiclink"` 驗證
   - ✓ 邏輯正確

### 真實問題：Log 顯示的 `user_recovery_requested` 是錯誤路徑

Log 中的 `auth_event: "user_recovery_requested"` 表示**密碼重設流程**被觸發，而不是登入流程。

**可能原因**：

1. **用戶實際上觸發了密碼重設**
   - 用戶點擊了 MemberDashboard 中的「重設密碼」功能
   - [app/member/MemberDashboard.tsx:1594](app/member/MemberDashboard.tsx#L1594) 調用 `resetPasswordForEmail`
   - 這會發送 `type: "recovery"` 的 OTP

2. **時間線推測**：
   ```
   04:46:03  用戶在設定頁面點擊「重設密碼」
             → resetPasswordForEmail 被調用
             → Supabase 發送 recovery OTP
             → auth_event: "user_recovery_requested" ✓
   
   04:46:27  用戶在登入頁面嘗試用這個 OTP 驗證
             → verifyOtp({ type: "email" })
             → Supabase 拒絕：type 不匹配 (recovery vs email)
             → error: "otp_expired" ✗
   ```

3. **另一個可能性**：前端路由混亂
   - 用戶同時打開了多個 tab/window
   - 在 A tab 觸發了密碼重設
   - 在 B tab 的登入頁面輸入收到的 recovery code
   - 兩個流程的 OTP 互相衝突

### 已識別的第二個問題：503 `reservation_completion_failed`

Log 提及的另一個錯誤：

```
[otp/send] reservation_completion_failed
message: 'reservation was not updated'
```

**位置**: [app/api/otp/send/route.ts:110](app/api/otp/send/route.ts#L110)

**觸發條件**：
1. `reserve_login_otp` 成功創建預訂
2. Engagelab SMS 發送成功
3. 但 `complete_login_otp` 更新數據庫失敗

**可能原因**：
- Database constraint violation
- Race condition（多個請求同時更新同一筆預訂）
- RLS policy 阻止更新

## 修復方案

### 1. 澄清用戶實際操作流程

**無需修改代碼**。需要向用戶確認：
- 04:46:03 時是否在設定頁面點擊了「重設密碼」？
- 是否同時打開了多個 Space8 頁面？
- 收到的郵件主旨是什麼？（登入驗證碼 vs 密碼重設）

### 2. 改善錯誤提示（可選優化）

當前 `verifyOtp` 失敗時，錯誤訊息為「驗證碼已過期」，但實際原因是 type 不匹配。

**建議**：在 [components/auth/AuthCard.tsx:648-659](components/auth/AuthCard.tsx#L648-L659) 增加更精確的錯誤判斷：

```typescript
if (vErr) {
  const expired = /expired/i.test(vErr.message)
  const invalid = /invalid/i.test(vErr.message)
  
  if (invalid && !expired) {
    // Type mismatch or wrong context
    setError("此驗證碼無效。請確認您使用的是登入驗證碼，而非密碼重設連結。")
  } else if (expired) {
    setError(t("err_otp_expired"))
  } else if (remaining > 0) {
    setError(t("err_otp_wrong", { count: remaining }))
  }
  // ...
}
```

### 3. 修復 `reservation_completion_failed` 問題

需要檢查 `complete_login_otp` stored procedure：

```bash
grep -rn "complete_login_otp" supabase/migrations/
```

**待確認**：
- 是否有 RLS policy 阻止更新
- 是否有 unique constraint 衝突
- 是否有 foreign key constraint 問題

## 結論

**當前登入 OTP 代碼本身沒有 type 不一致問題**。Log 中的 `user_recovery_requested` 表示用戶觸發了密碼重設流程，而非登入流程。

需要：
1. 向用戶確認實際操作步驟
2. 如果確認是用戶誤用，改善錯誤提示即可
3. 修復 `reservation_completion_failed` 需要進一步調查數據庫層
