// Customer-facing text for the reason codes prepare_checkout returns. The
// payment screens used to print the raw code (e.g. "audience_not_eligible").
const TEXT: Record<string, string> = {
  audience_not_eligible: '此優惠碼只適用於指定對象（例如新用戶），你的帳戶未符合資格。請移除優惠碼後再付款。',
  weekday_not_allowed: '此優惠碼不適用於你所選的日子。請移除優惠碼後再付款。',
  time_not_allowed: '此優惠碼不適用於你所選的時段。請移除優惠碼後再付款。',
  promo_not_stackable_with_credits: '此優惠碼不可與 Space Wallet 同時使用。請移除其中一項後再付款。',
  usage_limit_reached: '此優惠碼已被領完。',
  user_limit_reached: '你已用過此優惠碼，不能再次使用。',
  min_order_not_met: '未達此優惠碼的最低消費額。',
  not_started: '此優惠碼尚未生效。',
  expired: '此優惠碼已過期。',
  inactive: '此優惠碼暫時未能使用。',
  invalid: '無效的優惠碼。',
  insufficient_credits: 'Space Wallet 可用餘額不足。如有未完成的付款，額度會暫時被佔用，約 10 分鐘內自動釋放，亦可先取消該筆預約。',
  invalid_credits: 'Space Wallet 套用金額無效，請重新套用。',
  discount_selection_locked: '付款已發起，優惠已鎖定。如要更改，請返回選擇付款方式。',
  booking_not_pending: '此預約已完成或已取消，請重新選擇時段。',
  booking_not_found: '找不到此預約，請重新選擇時段。',
  booking_payment_processing: '系統正在確認你的付款，請稍候，毋須再次付款。',
  hold_expired: '時段保留已過期，請重新選擇時段。',
  points_redemption_retired: '積分已不能直接折抵，請改用 Space Wallet。',
}

/** Friendly text for a known checkout reason code, otherwise the input unchanged. */
export function checkoutErrorText(code: string): string {
  return TEXT[code] ?? code
}
