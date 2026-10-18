/**
 * Validation for `promotion_codes` — the checkout-facing code table.
 *
 * These rules match the brief exactly and must not drift from what
 * `prepare_checkout` accepts. Checkout's own rejections (audience_not_eligible,
 * min_order_not_met, inactive, …) are listed in lib/checkout/prepare.ts; the
 * admin UI writes every field those reasons depend on.
 *
 * `coupon_templates` / `user_coupons` are a different feature and are not
 * governed by this file.
 */

/**
 * One allowed bookable window. `prepare_checkout` reads these as
 * `(w->>'start')::time` / `(w->>'end')::time`, so the shape is fixed: a JSON
 * array of `{ start, end }` with `HH:MM` strings. End earlier than start is a
 * legal overnight window (checkout wraps it +24h).
 */
export type PromoTimeWindow = {
  start: string
  end: string
}

export type PromoCodeInput = {
  code: string
  name: string
  discountType: string
  discountValue: unknown
  status: string
  audience: string
  audienceThreshold: unknown
  maxUses: unknown
  perUserLimit: unknown
  minCartAmount: unknown
  maxDiscount: unknown
  validFrom: string | null
  validUntil: string | null
  stackableWithCredits: unknown
  stackableWithOtherCodes: unknown
  weekdays: unknown
  timeWindows: unknown
}

export type NormalizedPromoCode = {
  code: string
  name: string
  discountType: 'percentage' | 'fixed_amount'
  discountValue: number
  status: 'draft' | 'active' | 'disabled'
  audience: 'all' | 'new_users' | 'min_orders' | 'min_spend'
  audienceThreshold: number | null
  maxUses: number | null
  perUserLimit: number | null
  minCartAmount: number | null
  maxDiscount: number | null
  validFrom: string
  validUntil: string | null
  stackableWithCredits: boolean
  stackableWithOtherCodes: boolean
  /** ISO day-of-week, 1=Mon … 7=Sun — matches `extract(isodow FROM b.date)`. */
  weekdays: number[] | null
  timeWindows: PromoTimeWindow[] | null
}

export type NormalizeResult =
  | { ok: true; value: NormalizedPromoCode }
  | { ok: false; error: string }

/** Uppercase, 4–20 chars of A-Z / 0-9 / `-` only. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9-]{4,20}$/

/** `HH:MM` 24-hour — what `(w->>'start')::time` accepts. */
export const PROMO_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const STATUSES = new Set(['draft', 'active', 'disabled'])
const AUDIENCES = new Set(['all', 'new_users', 'min_orders', 'min_spend'])

type ParseOk<T> = { ok: true; value: T | null }
type ParseFail = { ok: false }
type ParseResult<T> = ParseOk<T> | ParseFail

/** ISO day-of-week integers accepted by `extract(isodow FROM b.date)`. */
function parseWeekdays(value: unknown): ParseResult<number[]> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (!Array.isArray(value)) return { ok: false }
  const out = new Set<number>()
  for (const raw of value) {
    const n = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isInteger(n) || n < 1 || n > 7) return { ok: false }
    out.add(n)
  }
  return {
    ok: true,
    value: out.size === 0 ? null : Array.from(out).sort((a, b) => a - b),
  }
}

/** Parse the JSON shape `prepare_checkout` iterates: `[{ start, end }]`. */
function parseTimeWindows(value: unknown): ParseResult<PromoTimeWindow[]> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (!Array.isArray(value)) return { ok: false }
  const out: PromoTimeWindow[] = []
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false }
    const rec = raw as Record<string, unknown>
    const start = typeof rec.start === 'string' ? rec.start.trim() : ''
    const end = typeof rec.end === 'string' ? rec.end.trim() : ''
    if (!PROMO_TIME_PATTERN.test(start) || !PROMO_TIME_PATTERN.test(end)) return { ok: false }
    if (start === end) return { ok: false }
    out.push({ start, end })
  }
  return { ok: true, value: out.length === 0 ? null : out }
}

function intOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return NaN
  return n
}

/** `{ ok: false }` is a parse failure; `{ ok: true, iso: null }` is "unset". */
function isoOrNull(value: string | null): { ok: true; iso: string | null } | { ok: false } {
  if (value === null || value.trim() === '') return { ok: true, iso: null }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { ok: false }
  return { ok: true, iso: d.toISOString() }
}

export function normalizePromoCodeInput(input: PromoCodeInput): NormalizeResult {
  const code = input.code.trim().toUpperCase()
  if (!PROMO_CODE_PATTERN.test(code)) {
    return {
      ok: false,
      error: '優惠碼必須為 4–20 位大寫英文字母、數字或連字號（A-Z 0-9 -）',
    }
  }

  const discountType = input.discountType
  if (discountType !== 'percentage' && discountType !== 'fixed_amount') {
    return { ok: false, error: '折扣類型必須為百分比或固定金額' }
  }

  const rawValue = typeof input.discountValue === 'number' ? input.discountValue : Number(input.discountValue)
  if (!Number.isFinite(rawValue) || !Number.isInteger(rawValue) || rawValue <= 0) {
    return { ok: false, error: '折扣數值必須為正整數' }
  }
  if (discountType === 'percentage' && (rawValue < 1 || rawValue > 100)) {
    return { ok: false, error: '百分比折扣必須介乎 1 至 100' }
  }

  const status = input.status || 'draft'
  if (!STATUSES.has(status)) {
    return { ok: false, error: '狀態必須為草稿、生效或停用' }
  }

  const audience = input.audience || 'all'
  if (!AUDIENCES.has(audience)) {
    return { ok: false, error: '適用對象必須為全部、新會員、最低訂單數或最低消費' }
  }

  const audienceThreshold = intOrNull(input.audienceThreshold)
  if (Number.isNaN(audienceThreshold)) {
    return { ok: false, error: '適用對象門檻必須為整數' }
  }
  if ((audience === 'min_orders' || audience === 'min_spend') && (audienceThreshold === null || audienceThreshold < 1)) {
    return { ok: false, error: '選擇最低訂單數或最低消費時，必須填寫大於 0 的門檻' }
  }

  const maxUses = intOrNull(input.maxUses)
  if (Number.isNaN(maxUses) || (maxUses !== null && maxUses < 1)) {
    return { ok: false, error: '使用次數上限必須為大於 0 的整數' }
  }

  const perUserLimit = intOrNull(input.perUserLimit)
  if (Number.isNaN(perUserLimit) || (perUserLimit !== null && perUserLimit < 1)) {
    return { ok: false, error: '每名會員上限必須為大於 0 的整數' }
  }

  const minCartAmount = intOrNull(input.minCartAmount)
  if (Number.isNaN(minCartAmount) || (minCartAmount !== null && minCartAmount < 0)) {
    return { ok: false, error: '最低消費必須為 0 或以上的整數' }
  }

  const maxDiscount = intOrNull(input.maxDiscount)
  if (Number.isNaN(maxDiscount) || (maxDiscount !== null && maxDiscount < 1)) {
    return { ok: false, error: '折扣上限必須為大於 0 的整數' }
  }

  const parsedFrom = isoOrNull(input.validFrom)
  if (!parsedFrom.ok) return { ok: false, error: '開始日期格式無效' }
  const parsedUntil = isoOrNull(input.validUntil)
  if (!parsedUntil.ok) return { ok: false, error: '結束日期格式無效' }
  // `valid_from` is NOT NULL on the table — an empty start means "now".
  const validFrom = parsedFrom.iso ?? new Date().toISOString()
  const validUntil = parsedUntil.iso
  if (validUntil !== null && validFrom >= validUntil) {
    return { ok: false, error: '結束日期必須遲於開始日期' }
  }

  const weekdays = parseWeekdays(input.weekdays)
  if (!weekdays.ok) {
    return { ok: false, error: '適用星期必須為 1 至 7 的整數（1 = 週一，7 = 週日）' }
  }

  const timeWindows = parseTimeWindows(input.timeWindows)
  if (!timeWindows.ok) {
    return { ok: false, error: '適用時段必須為開始及結束時間（HH:MM），且開始與結束不能相同' }
  }

  return {
    ok: true,
    value: {
      code,
      name: input.name.trim(),
      discountType,
      discountValue: rawValue,
      status: status as 'draft' | 'active' | 'disabled',
      audience: audience as 'all' | 'new_users' | 'min_orders' | 'min_spend',
      audienceThreshold: audienceThreshold === null || audience === 'all' || audience === 'new_users' ? null : audienceThreshold,
      maxUses,
      perUserLimit,
      minCartAmount,
      maxDiscount,
      validFrom,
      validUntil,
      stackableWithCredits: input.stackableWithCredits !== false,
      stackableWithOtherCodes: input.stackableWithOtherCodes === true,
      weekdays: weekdays.value,
      timeWindows: timeWindows.value,
    },
  }
}

/** ISO day-of-week → 書面語. Matches `extract(isodow FROM b.date)`. */
export function weekdayLabel(isoDow: number): string {
  switch (isoDow) {
    case 1:
      return '週一'
    case 2:
      return '週二'
    case 3:
      return '週三'
    case 4:
      return '週四'
    case 5:
      return '週五'
    case 6:
      return '週六'
    case 7:
      return '週日'
    default:
      return String(isoDow)
  }
}

/** ISO day-of-week order, 1 = Monday … 7 = Sunday. */
export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export function audienceLabel(a: string): string {
  switch (a) {
    case 'all':
      return '全部'
    case 'new_users':
      return '新會員'
    case 'min_orders':
      return '最低訂單數'
    case 'min_spend':
      return '最低消費'
    default:
      return a
  }
}

export function statusLabel(s: string): string {
  switch (s) {
    case 'draft':
      return '草稿'
    case 'active':
      return '生效中'
    case 'disabled':
      return '已停用'
    default:
      return s
  }
}

export function discountLabel(type: string, value: number): string {
  return type === 'percentage' ? `${value}%` : `HK$${value}`
}
