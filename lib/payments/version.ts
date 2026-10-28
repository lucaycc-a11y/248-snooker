/**
 * Payment system version — independent from the app version in package.json.
 *
 * Bump rules (semver):
 *   MAJOR  payment flow / money-handling behaviour changes
 *   MINOR  new payment features or admin tooling
 *   PATCH  bug fixes and copy fixes
 * Update PAYMENT_VERSION and add an entry at the top of PAYMENT_CHANGELOG
 * (and docs/PAYMENT_CHANGELOG.md) in the same commit as the change.
 */

export const PAYMENT_VERSION = '4.1.3'

export type PaymentChangelogEntry = {
  version: string
  date: string
  title: string
  features: string[]
  fixes: string[]
}

export const PAYMENT_CHANGELOG: PaymentChangelogEntry[] = [
  {
    version: '4.1.3',
    date: '2026-10-28',
    title: '付款後退出再入、金額更新由伺服器處理',
    features: [
      '付款後關閉瀏覽器／App 再返入預約頁，會直接帶到該張預約的付款狀態頁（開單 45 分鐘內仍待付款，或 15 分鐘內剛確認），不再顯示空白的選擇時段；每張預約每個瀏覽器工作階段只跳轉一次',
    ],
    fixes: [
      '「金額已更新」現由伺服器即時釋放舊的未付款預約（已付款的不會釋放），頁面無須再發取消請求，舊版頁面亦不會再重複碰到同一個錯誤',
    ],
  },
  {
    version: '4.1.2',
    date: '2026-10-28',
    title: '付款全面檢查：按鈕與路由修正',
    features: [],
    fixes: [
      '「返回選擇付款方式」按鈕：若 KPay 其實已收款，現會帶客人去確認頁，不再返回選擇頁（避免重複付款）；等候伺服器回覆最多約 1 秒',
      '確認頁「取消預約」按鈕：同樣在已付款時不再返回選擇時段',
      '取消失敗時不再顯示「此預訂已取消，已釋放時段」的錯誤訊息，改為真實的失敗提示',
      '「重新付款」不再被仍未付款的舊 KPay 單擋住（最長 30 分鐘）；只有已付款才會阻止，並改用與取消相同的 KPay 查詢（支援 UAT 主機）',
      'KPay 已收款但資料庫拒絕確認預約時，客人返回頁不再無限「確認中」，並即時電郵通知（每張預約 10 分鐘最多記錄一次）',
      '開單遇到已存在的付款單（只回傳單號、沒有付款連結）時，客戶端會轉到確認頁而不是顯示壞掉的付款畫面；移除一次多餘的 KPay 查詢',
      'Admin 付款監控補上新事件與對賬動作的中文名稱',
    ],
  },
  {
    version: '4.1.1',
    date: '2026-10-28',
    title: '付款異常即時電郵',
    features: [
      '付款出錯的一刻即時電郵（webhook 確認失敗、已付款轉覆核、重複付款、開單失敗等），不再等每 5 分鐘輪詢；電郵附該預約最近的付款時間線，同一問題只寄一次、12 小時後才提醒，10 分鐘最多 8 封',
      '真實客人的已付款異常寄給所有管理員，測試單與其他錯誤只寄店主',
    ],
    fixes: [],
  },
  {
    version: '4.1.0',
    date: '2026-10-28',
    title: '付款異常電郵警報與 Spark 付款診斷',
    features: [
      '自動巡檢現會每 5 分鐘執行：客人已付款但預約未能確認（payment_review）即時電郵，付款系統錯誤（webhook、開單、取消、狀態查詢）首次出現即電郵，並附 AI 診斷；真實客人的待覆核付款發給所有管理員，測試單只發給店主',
      'Spark 新增三個付款工具：查付款時間線、即時向 KPay 查單、列出待處理付款問題；可直接問「SPACE8-XXXXX-X 點解冇確認」',
    ],
    fixes: [
      '修正自動巡檢從未被排程執行，以致取消後被付款等異常沒有電郵通知',
    ],
  },
  {
    version: '4.0.7',
    date: '2026-10-28',
    title: '取消後被付款的舊單不再漏網',
    features: [
      '自動對賬會再查最近 40 分鐘內被客人取消的 KPay 單；若已被付款，時段仍空則自動確認，時段已被佔用則轉入 payment_review，不會自動退款',
    ],
    fixes: [
      '修正舊單被付款但時段已被新單佔用時（slots_active_start_uniq 重覆鍵錯誤），webhook 只標記失敗、沒有轉入 payment_review、沒有付款事件的問題',
    ],
  },
  {
    version: '4.0.6',
    date: '2026-10-28',
    title: '金額更新自動處理',
    features: [],
    fixes: [
      '修正開單時畫面金額與上一張未付款訂位不同（例如之後才使用 Space Wallet）而出現「付款失敗：金額已更新」；系統現會自動釋放舊單並按目前金額重新開單，客人不用返回再試',
    ],
  },
  {
    version: '4.0.5',
    date: '2026-10-28',
    title: '付款記錄修正與更快的取消回覆',
    features: [],
    fixes: [
      'Admin 測試付款開單後沒有登記 KPay 單號，令付款嘗試一直停在 claimed；現已與公開付款一致',
      '自動對賬會把「訂位已確認但嘗試未結案」的記錄補回為成功，不再誤標為沒有開單',
      '由 KPay 付款頁取消返回後，等候時間由 4 秒縮短為 2 秒（背景仍持續查詢，若已付款會即時顯示確認）',
    ],
  },
  {
    version: '4.0.4',
    date: '2026-10-28',
    title: '即時重新預約',
    features: [
      '客人取消、返回選擇付款方式或重新預約時，未付款的舊 KPay 單即時釋放訂位、時段、Space Wallet 金額與優惠碼，無須等待 25 分鐘；事件記錄 superseded_open_order / customer_released_open_order',
    ],
    fixes: [
      '修正客人想重新預約卻被舊單凍結的 Space Wallet 金額擋住（顯示餘額不足）',
      '已付款的訂單仍然不會被釋放；舊單日後才被付款時，系統自動確認並重新套用積分，時段被佔先則轉入 payment_review',
      '25 分鐘凍結只保留給「客人直接關閉頁面離開」的情況',
    ],
  },
  {
    version: '4.0.3',
    date: '2026-10-28',
    title: '更快釋放被凍結的訂單',
    features: [],
    fixes: [
      '未完成付款令時段、Space Wallet 金額與優惠碼被凍結的最長時間，由 60 分鐘縮短至 25 分鐘（KPay 已關閉嘅單仍然即時釋放）',
      '對賬排程由約 12 分鐘起逐張向 KPay 查詢；已付款自動確認，逾 25 分鐘仍未付款則結束該付款嘗試，其後清理程序釋放訂位',
      '凍結期縮短後，如舊單日後才被付款，仍由遲付款機制自動確認，時段被佔先則轉入 payment_review',
    ],
  },
  {
    version: '4.0.2',
    date: '2026-10-28',
    title: '錢包金額提示與付款返回頁防 404',
    features: [
      '/book 底下任何未知路徑（舊返回連結、截斷網址）自動導回預約頁並保留訂位編號，同時把路徑記入錯誤記錄（payments/book-unknown-path），方便追查',
    ],
    fixes: [
      '修正客人重新預約時顯示「Space Wallet 可用餘額不足」：實際係金額仍保留於上一張未完成付款（KPay 訂單仍可付款），現改為準確提示並建議改用其他付款方式或稍後再試',
      '修正付款返回後可能出現 404 頁面',
      '修正「金額已更新」重複出現：舊單仍在 KPay 開放時，取消被保護機制拒絕，導致每次重試都撞返同一張舊單；現在按「返回選擇付款方式」會釋放該舊單（已付款仍會拒絕；日後若舊單被付款，系統自動確認或轉入 payment_review）',
    ],
  },
  {
    version: '4.0.1',
    date: '2026-10-28',
    title: '付款保護全面生效與取消修正',
    features: [
      '付款保護預設對所有客人生效；如需緊急收回，在 Vercel 設 PAYMENT_FREEZE_PUBLIC=false 即可限回 admin',
      'Supabase 排程 payment-reconcile 每 5 分鐘向 KPay 對賬（需在 Vercel 設 PAYMENT_RECONCILE_CRON_SECRET）',
      '後台「付款監控」顯示付款系統版本與更新記錄',
    ],
    fixes: [
      '修正客人取消後仍可能收到款：舊行為取消前不查 KPay，現改為先問 KPay',
      '修正取消後付款嘗試仍顯示「待付款」：取消成功後同步結束付款嘗試',
      '修正事件記錄不準確：未向 KPay 查詢時不再寫成「KPay 已關閉」',
      '修正 Alipay 取消返回後長時間轉圈：約 4 秒後顯示「尚未收到付款」，並提供不取消訂單嘅返回選擇付款方式掣；後台繼續查詢，真正付款仍會自動確認',
      '客人文案由口語改為書面中文，並移除重複提示',
      '價格變更時釋放舊單，避免舊單殘留（c2b12ea）',
    ],
  },
  {
    version: '4.0.0',
    date: '2026-10-26',
    title: 'KPay 付款保護與可追查性',
    features: [
      '付款保護：取消、改選付款方式、重試前先向 KPay 查單；仍可付款或已付款嘅訂單，訂位、時段、積分與優惠碼保持凍結',
      '已付款自動確認：任何已付款 QR（新舊單皆可）都自動確認訂位；時段已被佔先才轉入 payment_review，交人處理；不自動退款',
      '舊訂位遲付款復原：重新套用已釋放嘅積分與優惠碼；錢包餘額不足時仍確認並記錄差額',
      '先返回確認頁再去付款：付款 H5 先到確認頁，再跳 Alipay，返回時必定落在唯讀確認頁，不會回到付款方式選擇',
      '付款參考編號（訂位編號、KPay 訂單尾碼、狀態碼、時間）與預填 WhatsApp 客服訊息，所有付款失敗／未完成頁面一致',
      '重複付款偵測：同一訂位收到多於一筆付款時通知 admin，不自動動用款項',
      'payment_events 時間線：每次付款狀態決定都寫入，僅 admin 可讀',
      '後台「付款監控」：真實數據總覽、需要處理清單、單一訂位時間線搜尋、即時查詢 KPay、自動對賬',
      'KPay 查單優化：相同訂單 1.5 秒內共用一次查詢，逾時／網絡錯誤／5xx 自動重試一次，減少 log 噪音',
    ],
    fixes: [
      '修正取消／取代訂位時釋放仍可付款嘅 KPay 訂單，導致客人付款後被判「付款未完成」',
      '修正過期清理（15 分鐘）誤清有進行中 KPay 訂單嘅待付款訂位，並記錄 swept_expired',
      '修正開始新鎖位時釋放另一張仍可付款訂單嘅時段（release_my_locks）',
      '修正 webhook 遲到付款自動退款令帳目混亂：移除自動退款，改為確認或轉入 payment_review',
      '修正 webhook 時間戳過舊時直接拒絕：改為向 KPay 重新驗證後處理',
      '修正 KPay transactionState=3（訂單已關閉）未處理',
      '修正 queryOrder 失敗時誤報付款失敗：改為持續等待並顯示查詢錯誤狀態',
    ],
  },
]
