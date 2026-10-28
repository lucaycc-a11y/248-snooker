# Payment system changelog

Payment version is tracked separately from the app version (`package.json`). Source of truth: `lib/payments/version.ts` (`PAYMENT_VERSION`, `PAYMENT_CHANGELOG`). Update both files in the same commit.

Bump rules: MAJOR = payment flow / money-handling behaviour, MINOR = new features or admin tooling, PATCH = bug and copy fixes.

## v4.0.6 — 2026-10-28 — 金額更新自動處理

### Bug fixes
- 修正開單時畫面金額與上一張未付款訂位不同（例如之後才使用 Space Wallet）而出現「付款失敗：金額已更新」；系統現會自動釋放舊單並按目前金額重新開單，客人不用返回再試

## v4.0.5 — 2026-10-28 — 付款記錄修正與更快的取消回覆

### Bug fixes
- Admin 測試付款開單後沒有登記 KPay 單號，令付款嘗試一直停在 claimed；現已與公開付款一致
- 自動對賬會把「訂位已確認但嘗試未結案」的記錄補回為成功，不再誤標為沒有開單
- 由 KPay 付款頁取消返回後，等候時間由 4 秒縮短為 2 秒（背景仍持續查詢，若已付款會即時顯示確認）

## v4.0.4 — 2026-10-28 — 即時重新預約

### Features
- 客人取消、返回選擇付款方式或重新預約時，未付款的舊 KPay 單即時釋放訂位、時段、Space Wallet 金額與優惠碼，無須等待 25 分鐘；事件記錄 superseded_open_order / customer_released_open_order

### Bug fixes
- 修正客人想重新預約卻被舊單凍結的 Space Wallet 金額擋住（顯示餘額不足）
- 已付款的訂單仍然不會被釋放；舊單日後才被付款時，系統自動確認並重新套用積分，時段被佔先則轉入 payment_review
- 25 分鐘凍結只保留給「客人直接關閉頁面離開」的情況

## v4.0.3 — 2026-10-28 — 更快釋放被凍結的訂單

### Bug fixes
- 未完成付款令時段、Space Wallet 金額與優惠碼被凍結的最長時間，由 60 分鐘縮短至 25 分鐘（KPay 已關閉嘅單仍然即時釋放）
- 對賬排程由約 12 分鐘起逐張向 KPay 查詢；已付款自動確認，逾 25 分鐘仍未付款則結束該付款嘗試，其後清理程序釋放訂位
- 凍結期縮短後，如舊單日後才被付款，仍由遲付款機制自動確認，時段被佔先則轉入 payment_review

## v4.0.2 — 2026-10-28 — 錢包金額提示與付款返回頁防 404

### Features
- /book 底下任何未知路徑（舊返回連結、截斷網址）自動導回預約頁並保留訂位編號，同時把路徑記入錯誤記錄（payments/book-unknown-path），方便追查

### Bug fixes
- 修正客人重新預約時顯示「Space Wallet 可用餘額不足」：實際係金額仍保留於上一張未完成付款（KPay 訂單仍可付款），現改為準確提示並建議改用其他付款方式或稍後再試
- 修正付款返回後可能出現 404 頁面
- 修正「金額已更新」重複出現：舊單仍在 KPay 開放時，取消被保護機制拒絕，導致每次重試都撞返同一張舊單；現在按「返回選擇付款方式」會釋放該舊單（已付款仍會拒絕；日後若舊單被付款，系統自動確認或轉入 payment_review）

## v4.0.1 — 2026-10-28 — 付款保護全面生效與取消修正

### Features
- 付款保護預設對所有客人生效；如需緊急收回，在 Vercel 設 PAYMENT_FREEZE_PUBLIC=false 即可限回 admin
- Supabase 排程 payment-reconcile 每 5 分鐘向 KPay 對賬（需在 Vercel 設 PAYMENT_RECONCILE_CRON_SECRET）
- 後台「付款監控」顯示付款系統版本與更新記錄

### Bug fixes
- 修正客人取消後仍可能收到款：舊行為取消前不查 KPay，現改為先問 KPay
- 修正取消後付款嘗試仍顯示「待付款」：取消成功後同步結束付款嘗試
- 修正事件記錄不準確：未向 KPay 查詢時不再寫成「KPay 已關閉」
- 修正 Alipay 取消返回後長時間轉圈：約 4 秒後顯示「尚未收到付款」，並提供不取消訂單嘅返回選擇付款方式掣；後台繼續查詢，真正付款仍會自動確認
- 客人文案由口語改為書面中文，並移除重複提示
- 價格變更時釋放舊單，避免舊單殘留（c2b12ea）

## v4.0.0 — 2026-10-26 — KPay 付款保護與可追查性

### Features
- 付款保護：取消、改選付款方式、重試前先向 KPay 查單；仍可付款或已付款嘅訂單，訂位、時段、積分與優惠碼保持凍結
- 已付款自動確認：任何已付款 QR（新舊單皆可）都自動確認訂位；時段已被佔先才轉入 payment_review，交人處理；不自動退款
- 舊訂位遲付款復原：重新套用已釋放嘅積分與優惠碼；錢包餘額不足時仍確認並記錄差額
- 先返回確認頁再去付款：付款 H5 先到確認頁，再跳 Alipay，返回時必定落在唯讀確認頁，不會回到付款方式選擇
- 付款參考編號（訂位編號、KPay 訂單尾碼、狀態碼、時間）與預填 WhatsApp 客服訊息，所有付款失敗／未完成頁面一致
- 重複付款偵測：同一訂位收到多於一筆付款時通知 admin，不自動動用款項
- payment_events 時間線：每次付款狀態決定都寫入，僅 admin 可讀
- 後台「付款監控」：真實數據總覽、需要處理清單、單一訂位時間線搜尋、即時查詢 KPay、自動對賬
- KPay 查單優化：相同訂單 1.5 秒內共用一次查詢，逾時／網絡錯誤／5xx 自動重試一次，減少 log 噪音

### Bug fixes
- 修正取消／取代訂位時釋放仍可付款嘅 KPay 訂單，導致客人付款後被判「付款未完成」
- 修正過期清理（15 分鐘）誤清有進行中 KPay 訂單嘅待付款訂位，並記錄 swept_expired
- 修正開始新鎖位時釋放另一張仍可付款訂單嘅時段（release_my_locks）
- 修正 webhook 遲到付款自動退款令帳目混亂：移除自動退款，改為確認或轉入 payment_review
- 修正 webhook 時間戳過舊時直接拒絕：改為向 KPay 重新驗證後處理
- 修正 KPay transactionState=3（訂單已關閉）未處理
- 修正 queryOrder 失敗時誤報付款失敗：改為持續等待並顯示查詢錯誤狀態

