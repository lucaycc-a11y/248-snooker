# Supabase Phone Auth 設定指引 (Part 2)

## 前置條件

- ✅ Part 0 緊急修復已部署並測試通過
- ✅ Part 1 Send SMS Hook 代碼已推送
- ✅ Part 3 Backfill 已完成 (7/7 用戶)

---

## Step 1: 生成 Webhook Secret

在終端執行:

```bash
openssl rand -base64 32
```

複製輸出的 secret,例如: `abcd1234efgh5678ijkl9012mnop3456qrst7890uvwx==`

---

## Step 2: 設定環境變數

### 本地開發 (`.env.local`)

```bash
# Supabase Auth Hook Secret (Part 2)
SUPABASE_AUTH_HOOK_SECRET="<剛才生成的 secret>"

# Engagelab Template ID (需要先在 Engagelab 創建)
ENGAGELAB_SUPABASE_TEMPLATE_ID="<template-id>"
```

### Vercel Production

1. 進入 Vercel Dashboard
2. 選擇 `space8-web` 專案
3. Settings → Environment Variables
4. 新增兩個變數:
   - `SUPABASE_AUTH_HOOK_SECRET`: 剛才生成的 secret
   - `ENGAGELAB_SUPABASE_TEMPLATE_ID`: template ID

5. 重新部署以載入新環境變數

---

## Step 3: 在 Engagelab 創建 SMS Template

### Template 要求

需要創建一個支持 **自訂驗證碼變數** 的 template:

```
【Space8】您的驗證碼是 {{code}},有效期10分鐘。請勿告訴他人。
```

重點:
- ✅ 必須包含 `{{code}}` 變數 (Supabase 會傳入驗證碼)
- ✅ 不要用 Engagelab 自己的驗證碼生成功能
- ✅ 10分鐘有效期與 Supabase 預設一致

### 執行步驟

1. 登入 Engagelab Console
2. 進入 SMS Templates
3. 創建新 template:
   - Name: `Space8 Supabase OTP`
   - Content: 上面的內容
   - 變數: `code`
4. 提交審核 (如需要)
5. 審核通過後,複製 **Template ID**
6. 將 Template ID 填入上面 Step 2 的 `ENGAGELAB_SUPABASE_TEMPLATE_ID`

---

## Step 4: Supabase Dashboard 設定

### 4.1 開啟 Phone Provider

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard/project/wqmciwieiqvnswvspdyz)
2. 左側選單: **Authentication** → **Providers**
3. 找到 **Phone** provider
4. 點擊 **Enable Phone provider**
5. 儲存

### 4.2 設定 Send SMS Hook

1. 左側選單: **Authentication** → **Hooks**
2. 找到 **Send SMS** hook
3. 選擇 hook 類型: **HTTPS**
4. 填入以下資訊:

   **Hook URL:**
   ```
   https://space8.com.hk/api/auth/hooks/send-sms
   ```

   **Secret (Webhook Signature):**
   ```
   <Step 1 生成的 secret>
   ```

5. 點擊 **Save**

### 4.3 確認 Rate Limits (選擇性)

1. 左側選單: **Authentication** → **Rate Limits**
2. 檢查以下設定:
   - **Phone OTP requests:** 預設可能是 10 requests / 1 hour
   - **Phone verification:** 預設可能是 5 requests / 1 hour

3. 如果需要調整,修改後儲存

---

## Step 5: 測試 Webhook

### 5.1 測試腳本

```bash
# 在專案根目錄執行
npx tsx scripts/test-send-sms-hook.ts
```

### 5.2 預期輸出

```
✅ Send SMS Hook 測試成功
   - Webhook 簽名驗證通過
   - Engagelab API 調用成功
   - SMS 已發送到測試電話
```

### 5.3 如果失敗

檢查:
- [ ] `SUPABASE_AUTH_HOOK_SECRET` 環境變數是否正確
- [ ] `ENGAGELAB_SUPABASE_TEMPLATE_ID` 是否正確
- [ ] Engagelab template 是否審核通過
- [ ] Webhook URL 是否可以從 Supabase 訪問 (檢查 firewall/CORS)

---

## Step 6: 驗證整合

### 6.1 從 Supabase 觸發 OTP

在 Supabase SQL Editor 執行:

```sql
-- 這會觸發 Send SMS Hook
SELECT auth.send_sms_otp('+85212345678');
```

### 6.2 檢查日誌

**Vercel 日誌:**
```
[send-sms-hook] received request
[send-sms-hook] signature verified
[send-sms-hook] sending via Engagelab
[send-sms-hook] SMS sent successfully
```

**Supabase 日誌:**
```
Authentication → Logs → Hooks
應該看到 Send SMS Hook 的調用記錄
```

---

## 完成檢查清單

- [ ] Webhook secret 已生成
- [ ] 環境變數已設定 (`.env.local` + Vercel)
- [ ] Engagelab template 已創建並審核通過
- [ ] Template ID 已填入環境變數
- [ ] Supabase Phone provider 已開啟
- [ ] Supabase Send SMS Hook 已設定
- [ ] 測試腳本執行成功
- [ ] 從 Supabase 觸發 OTP 測試成功
- [ ] 日誌顯示 webhook 正常工作

---

## 下一步

Part 2 完成後,即可執行:
- **Part 4:** 前端遷移到 Supabase 原生 auth
- **Part 5:** 舊系統退役

---

## 故障排除

### 問題: Webhook 簽名驗證失敗

```
[send-sms-hook] signature verification failed
```

**解決:**
- 確認 Supabase Dashboard 填入的 secret 與環境變數一致
- 重新部署 Vercel (確保環境變數已載入)

### 問題: Engagelab API 錯誤

```
[send-sms-hook] Engagelab API error
```

**解決:**
- 確認 `ENGAGELAB_SUPABASE_TEMPLATE_ID` 正確
- 確認 template 已審核通過
- 檢查 Engagelab API key 是否有效

### 問題: 電話號碼格式錯誤

```
[send-sms-hook] Invalid phone number format
```

**解決:**
- 確認電話號碼格式為 E.164 (+85212345678)
- Supabase 會自動處理格式,但測試時要用正確格式

---

**文檔版本:** 1.0  
**最後更新:** 2026-09-12
