/**
 * Revenue definitions — the single source of truth for the 收入 page and the
 * Excel export. Both read this file so the screen and the file cannot disagree.
 *
 * Decision (Luca, 2026-10-18): 收入 means **amount collected** — what the
 * customer actually parted with. `bookings.total_price` is already net of
 * promo / points / credit discounts (live row: base 352 − credit 10 = 342),
 * so discount amounts are shown as their own KPI tiles and are never
 * subtracted from 收入 a second time.
 *
 * Consequence to state on the page (「計算方式」 note):
 *   淨收入 = 收入 − 退款
 * and NOT 淨收入 = 收入 − 折扣 − 退款, which would double-count the discounts.
 *
 * Everything below is derivable from live columns. Nothing is invented.
 * `payment_attempts` has no amount column and is currently empty, so the
 * reconciliation check can only join `bookings.total_price` through
 * `booking_id` — that limitation is reported on the page, not papered over.
 */

export type RevenueRange = {
  /** Inclusive, Hong Kong time. */
  from: string
  /** Inclusive, Hong Kong time. */
  to: string
}

export type RevenueFilters = {
  range: RevenueRange
  /** `bookings.payment_method`; null = all methods. */
  paymentMethod: string | null
  /** Default false — test bookings stay out of the money. */
  includeTest: boolean
  /** Default false — hidden users stay out of every total. */
  includeHidden: boolean
}

export type RevenueTotals = {
  /** Σ total_price where status = 'confirmed'. Amount collected. */
  revenue: number
  /** Count of those confirmed bookings. */
  bookingCount: number
  /** revenue / bookingCount, 0 when empty. */
  averagePerBooking: number
  /** Σ refund_amount on refunded / partly refunded bookings. */
  refund: number
  /** Σ promo_discount on confirmed bookings — given away, not subtracted again. */
  promoDiscount: number
  /** Σ points_discount on confirmed bookings — tender, already inside total_price. */
  pointsDiscount: number
  /** Σ credit_discount on confirmed bookings — tender, already inside total_price. */
  creditDiscount: number
  /** revenue − refund. */
  net: number
}

export type RevenueBucket = {
  key: string
  label: string
  revenue: number
  count: number
}

export type PromoUsageRow = {
  code: string
  uses: number
  totalDiscount: number
}

export type RevenueDetailRow = {
  id: string
  humanCode: string | null
  date: string
  startTime: string
  tableNumber: number | null
  memberName: string | null
  memberPhone: string | null
  memberCode: string | null
  status: string
  paymentMethod: string | null
  /** Amount collected (net). */
  amount: number
  promoCode: string | null
  promoDiscount: number
  refundAmount: number
  isTest: boolean
  isHiddenUser: boolean
}

/** Shown verbatim on the page and on the Excel 摘要 sheet. */
export const REVENUE_DEFINITIONS_NOTE = [
  '收入 = 已確認預約的 total_price 總和（客戶實付，已扣優惠碼 / 積分 / Credit）。',
  '退款 = 已退款或部分退款預約的 refund_amount 總和。',
  '淨收入 = 收入 − 退款。',
  '優惠碼折扣、積分折扣、Credit 折扣均為已讓出之金額，已包含在 total_price 內，不再重複扣減。',
  '所有日期以香港時間計算。',
  '預設不包括測試預約及已隱藏帳戶。',
].join('\n')

/** Row cap for the Excel 預約明細 sheet. Stated on the 摘要 sheet when hit. */
export const EXPORT_ROW_LIMIT = 10000

export function emptyTotals(): RevenueTotals {
  return {
    revenue: 0,
    bookingCount: 0,
    averagePerBooking: 0,
    refund: 0,
    promoDiscount: 0,
    pointsDiscount: 0,
    creditDiscount: 0,
    net: 0,
  }
}
