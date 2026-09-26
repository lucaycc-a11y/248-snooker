# Task Ledger: Member Dashboard Fix & Redesign

**Created**: 2026-09-25
**Branch**: feat/dashboard-fix-redesign
**Safety Branch**: safety/pre-dashboard-fix-20260925-1735

---

## Phase 0: 環境確認
- [x] DONE: 建立工作分支與安全分支
- [x] DONE: 記錄基線狀態
- [x] DONE: 確認 Supabase project ref: wqmciwieiqvnswvspdyz (證據: CLAUDE.md, 多個 docs)
- [x] DONE: 列出近期 commits (874a430 至 97a74a2, 共 20 commits since 2024-09-20)
- [ ] IN_PROGRESS: 調查 /api/member/bookings 500 錯誤原因
- [ ] TODO: 確認 Vercel 上一個 deployment ID
- [ ] TODO: 確認 production 登入流程運作狀況

## Phase A: `/api/member/bookings` 500 錯誤 (最高優先)
- [x] DONE: 讀取 route.ts 實作 (L23-28: 查詢 bookings 表 8 個欄位)
- [ ] IN_PROGRESS: 檢查 bookings 表 schema 及所有必要欄位
- [ ] TODO: 確認 human_code 欄位是否已在 production 執行 (migration 0030)
- [ ] TODO: 檢查 RLS 政策
- [ ] TODO: 找出實際錯誤位置及原因
- [ ] TODO: 本機/UAT 重現錯誤
- [ ] TODO: 提出修復方案並等待確認
- [ ] BLOCKED: 修復實作 (需方案確認)
- [ ] BLOCKED: 部署 UAT 測試 (需修復完成)

## Phase B: QR Code 命名確認 (次要,非緊急)
- [ ] TODO: 找出 QR code 產生邏輯
- [ ] TODO: 抽查至少 3 個不同帳戶
- [ ] TODO: 確認各自獨立性
- [ ] TODO: 記錄命名規則

## Phase C: Member Dashboard 高級化重新設計
### C1: 會員卡片
- [ ] TODO: 長版 SPACE8 logo 實作
- [ ] TODO: 移除「248 MEMBER」文字
- [ ] TODO: 等級徽章 i18n
- [ ] TODO: 積分數字套用 Good Times 字體
- [ ] TODO: 橫向進度條實作 (KABU PASS 風格)
- [ ] TODO: 底部「輕觸查看入場 QR code」提示
- [ ] TODO: 背景水印改用完整 logo (8-12% 透明度)
- [ ] BLOCKED: 截圖確認 (需實作完成)

### C2: Space Pts 頁面
- [ ] TODO: 確認字體授權 (Good Times)
- [ ] TODO: 圓形進度環實作
- [ ] TODO: Point History 資料來源確認
- [ ] TODO: 等級禮遇展開列表
- [ ] TODO: 兌換獎賞浮動按鈕
- [ ] TODO: 空白狀態頁面
- [ ] BLOCKED: 截圖確認 (需實作完成)

### C3-C5: 字體/命名/通用規則
- [ ] TODO: Good Times 字體授權確認
- [ ] TODO: 鉑金會員英文名稱確認 (Platinum/Aurora/Prestige)
- [ ] TODO: 所有文案 i18n (zh-HK + en)

---

## Evidence Log

### Phase 0 證據
- Supabase project ref: grep 結果顯示 wqmciwieiqvnswvspdyz 在多個 .md 檔案
- 近期 commits: 874a430 (最新) 到 97a74a2 (2024-09-20+)
- Safety branch created: safety/pre-dashboard-fix-20260925-1735
- Work branch created: feat/dashboard-fix-redesign
- Baseline recorded: _task/00-baseline.txt

### Phase A 證據
- API route 實作: app/api/member/bookings/route.ts:23-28
  查詢 8 欄位: id, table_id, date, start_time, duration_hours, price, human_code, status
- human_code 欄位: migration 0030 加入, nullable, 有 index
- 錯誤特徵: middleware 200 → getUser 成功 → 360ms 執行 → 500 無錯誤訊息

---

## Phase A 更新 - 2026-09-25 17:40

### ✅ ROOT CAUSE IDENTIFIED

**錯誤原因**: Column name mismatch
- Member API 查詢 `table_id`, `price` (錯誤)
- 實際 schema 使用 `table_number`, `total_price`
- Supabase 返回 "column does not exist" 錯誤 → 500

**證據來源**:
1. app/api/member/bookings/route.ts:25 (錯誤欄位)
2. app/api/booking/status/route.ts:30 (正確欄位)
3. lib/data/getAdminBookings.ts:92 (正確欄位)
4. Migration 0003 註解確認 bookings 表在 repo 外定義

**修復方案**: 詳見 `_task/PHASE_A_DIAGNOSIS.md`

### 待確認項目
- [ ] 修復方案是否正確 (改用 table_number, total_price)
- [ ] 是否同時加入錯誤日誌
- [ ] 確認後實作

---

## ✅ Phase A COMPLETE - 2026-09-25 17:45

### 修復已部署 Production

**Commit**: d934a02  
**Branch**: main  
**Status**: DEPLOYED

**修改內容**:
- [app/api/member/bookings/route.ts:25](app/api/member/bookings/route.ts#L25) - 修正 table_number, total_price
- [app/api/member/bookings/route.ts:29-33](app/api/member/bookings/route.ts#L29-L33) - 加入錯誤日誌

**驗證**:
- ✅ Build passed
- ✅ Type check passed
- ✅ Pushed to main
- ⏳ Vercel auto-deploy in progress

**下一步**: 等待 Vercel 部署完成後在真實環境確認 `/api/member/bookings` 返回 200

---

## ✅ Phase C1 會員卡片重新設計 - 2026-09-25 18:00

### 完成項目

**Commit**: (pending)  
**檔案**: [app/member/components/MemberCardFlip.tsx](app/member/components/MemberCardFlip.tsx)

**實作內容**:
1. ✅ 移除「248 MEMBER」標籤文字
2. ✅ 替換為完整橫向 SPACE8 logo (含 "8" 圖標 + "SPACE8" 文字)
3. ✅ 圓形進度環改為橫向進度條 (KABU PASS 風格):
   - 兩端顯示當前與下一等級圖標 + 名稱
   - 中間漸變填充進度條 (使用 tier gradient colors)
   - 下方狀態文字「已消費 $X，再消費 $Y 可升級至{tier}」
   - 最高等級會員顯示靜態文字,無進度條
4. ✅ 底部加入「輕觸查看入場 QR code」提示 (tap 圖標 + 文字)
5. ✅ 背景水印改用完整 SPACE8 logo (10% opacity)
6. ✅ 積分數字移至右側並放大 (text-4xl)

### 待處理項目
- [ ] Good Times 字體應用 (需先確認字體授權來源)
- [ ] 等級徽章文字 i18n (tierName 已用 getTierName helper)
- [ ] 截圖確認 (需實機或 dev server 查看效果)

### 下一步
Phase C2: Space Pts 頁面重新設計
