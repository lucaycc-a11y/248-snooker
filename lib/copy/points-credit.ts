/**
 * Copy deck for Space Points and Space Wallet (user-facing strings).
 * All strings in Standard Chinese (traditional); localization via next-intl.
 */

export const POINTS_CREDIT_COPY = {
  // Rules — Help Center, Space Wallet, SPACE PTS explanation
  rules: {
    earning:
      '每消費 HK$1 累積 1 積分，以實付金額計算（已扣除優惠碼或 Space Wallet 折抵）。',
    autoConvert:
      '每累積 100 積分，自動存入 HK$10 至你的 Space Wallet，無需任何操作。',
    sameOrderRestriction:
      '當次消費所得積分於付款成功後入帳，不可用於本次訂單。',
    mutuallyExclusive:
      '優惠碼與 Space Wallet 只能擇一使用。',
    walletNoPoints:
      '使用 Space Wallet 不會減少累積積分，亦不會影響會員級別。',
    signupBonus:
      '新會員完成註冊即送 100 積分，並自動存入 HK$10 至 Space Wallet。',
    refund:
      '訂單退款時，已使用的 Space Wallet 金額會全數退回，該訂單所得積分會一併扣回。',
  },

  // Checkout UI
  checkout: {
    subtotalLabel: '小計',
    pointsLabel: '可賺積分',
    totalLabel: '總計',
    walletBalanceLabel: 'Space Wallet 可用餘額',
    applyButton: '套用',
    appliedLabel: '已套用 Space Wallet',
    removeLink: '移除',
    confirmButton: '確認預約',
    pointsNote:
      '積分以實付金額計算（已扣除優惠碼或 Space Wallet 折抵），每 HK$1 累積 1 積分；當次積分於付款成功後入帳，不可用於本次訂單。',
  },

  // Checkout errors
  checkoutErrors: {
    insufficient_credits: 'Space Wallet 餘額不足，目前可用 HK${{amount}}。',
    discounts_mutually_exclusive: '優惠碼與 Space Wallet 只能擇一使用。',
    invalid_credits: '無法套用 Space Wallet，請重新整理後再試。',
    booking_not_pending: '此訂單已完成或已失效，請重新選擇時段。',
    discount_selection_locked: '付款已開始，無法更改優惠。',
    promoCodeApplied: '已使用優惠碼，無法同時使用 Space Wallet。',
    walletApplied: '已使用 Space Wallet，無法同時使用優惠碼。',
    fallback: '暫時無法套用，請稍後再試。',
  },

  // Wallet ledger labels
  creditLedgerTypes: {
    convert: '積分存入',
    signup: '迎新禮',
    topup: '增值',
    redeem: '預約折抵',
    refund: '退款退回',
    reversal: '退款調整',
    manual: '系統調整',
  },

  // Points ledger labels
  pointsLedgerTypes: {
    booking: '預約消費',
    signup: '迎新禮',
    reversal: '退款扣回',
    redeem: '舊制兌換',
    manual: '系統調整',
  },

  // Space Wallet page
  spaceWallet: {
    title: 'Space Wallet',
    balanceLabel: 'Space Wallet 餘額',
    description: '1 元 = HK$1，可直接抵扣預約費用。',
    statementLabel: '餘額變動紀錄',
    emptyState: '目前沒有交易紀錄',
    noTopupNote: '成員自助儲值功能即將推出。',
  },

  // SPACE PTS page
  spacePts: {
    title: 'SPACE PTS',
    lifetimeLabel: '累積積分',
    redeemableLabel: '可兌換積分',
    convertedLabel: '已兌換積分',
    nextConversionLabel: '再累積 {{points}} 積分，自動存入 HK$10 至 Space Wallet',
    historyLabel: '積分變動紀錄',
    explainLabel: '積分如何運作',
    emptyState: '目前沒有積分紀錄',
  },

  // Inbox
  inbox: {
    title: '優惠資訊',
    emptyState: '暫無通知',
    markAllReadButton: '全部標為已讀',
    walletRelated: 'Space Wallet',
  },
} as const
