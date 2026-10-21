// Customer-facing text for the reason codes prepare_checkout returns. The
// payment screens used to print the raw code (e.g. "audience_not_eligible").
const TEXT: Record<string, string> = {
  audience_not_eligible: '此優惠碼只適用於指定對象（例如新用戶），你嘅帳戶未符合資格。請移除優惠碼後再付款。',
  weekday_not_allowed: '此優惠碼不適用於你所選嘅日子。請移除優惠碼後再付款。',
  time_not_allowed: '此優惠碼不適用於你所選嘅時段。請移除優惠碼後再付款。',
  promo_not_stackable_with_credits: '此優惠碼不可與 Space Wallet 同時使用。請移除其中一項後再付款。',
  usage_limit_reached: '此優惠碼已被領完。',
  user_limit_reached: '你已用過此優惠碼，不能再次使用。',
  min_order_not_met: '未達此優惠碼嘅最低消費。',
  not_started: '此優惠碼尚未生效。',
  expired: '此優惠碼已過期。',
  inactive: '此優惠碼暫時未能使用。',
  invalid: '無效嘅優惠碼。',
  insufficient_credits: 'Space Wallet 餘額不足，請重新套用。',
  invalid_credits: 'Space Wallet 套用金額無效，請重新套用。',
}

/** Friendly text for a known checkout reason code, otherwise the input unchanged. */
export function checkoutErrorText(code: string): string {
  return TEXT[code] ?? code
}
