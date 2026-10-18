/**
 * Validation for promotion_codes writes. Uses only the real CHECK values:
 * discount_type percentage|fixed_amount, status draft|active|disabled,
 * audience all|new_users|min_orders|min_spend.
 * `is_active` is what checkout reads, so it is always derived from `status`.
 */

export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const
export const STATUSES = ['draft', 'active', 'disabled'] as const
export const AUDIENCES = ['all', 'new_users', 'min_orders', 'min_spend'] as const

export type PromoInput = {
  code?: string
  name: string | null
  discount_type: (typeof DISCOUNT_TYPES)[number]
  discount_value: number
  max_discount: number | null
  min_cart_amount: number | null
  max_uses: number | null
  per_user_limit: number | null
  audience: (typeof AUDIENCES)[number]
  audience_threshold: number | null
  valid_from: string
  valid_until: string | null
  status: (typeof STATUSES)[number]
  is_active: boolean
}

function isRec(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function optNum(v: unknown): number | null | undefined {
  if (v === null || v === '' || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
function optDate(v: unknown): string | null | undefined {
  if (v === null || v === '' || v === undefined) return null
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return undefined
  return new Date(v).toISOString()
}

export function parsePromoInput(
  body: unknown,
  opts: { requireCode: boolean },
): { ok: true; value: PromoInput } | { ok: false; error: string } {
  if (!isRec(body)) return { ok: false, error: '資料格式錯誤' }

  let code: string | undefined
  if (opts.requireCode) {
    code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!/^[A-Z0-9-]{4,20}$/.test(code)) {
      return { ok: false, error: '優惠碼只可用 A-Z、0-9、「-」，長度 4 至 20 個字元' }
    }
  }

  const discountType = body.discount_type
  if (!DISCOUNT_TYPES.includes(discountType as never)) return { ok: false, error: '請選擇折扣類型' }
  const value = Number(body.discount_value)
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: '折扣數值必須大於 0' }
  if (discountType === 'percentage' && (value > 100 || !Number.isInteger(value))) {
    return { ok: false, error: '百分比折扣必須是 1 至 100 的整數' }
  }
  if (discountType === 'fixed_amount' && !Number.isInteger(value)) {
    return { ok: false, error: '固定金額必須是整數（HK$）' }
  }

  const maxDiscount = optNum(body.max_discount)
  const minCart = optNum(body.min_cart_amount)
  const maxUses = optNum(body.max_uses)
  const perUser = optNum(body.per_user_limit)
  const threshold = optNum(body.audience_threshold)
  if (maxDiscount === undefined || (maxDiscount !== null && maxDiscount < 0)) return { ok: false, error: '折扣上限無效' }
  if (minCart === undefined || (minCart !== null && minCart < 0)) return { ok: false, error: '最低消費無效' }
  if (maxUses === undefined || (maxUses !== null && (maxUses <= 0 || !Number.isInteger(maxUses)))) {
    return { ok: false, error: '總使用次數必須是正整數，或留空代表不限' }
  }
  if (perUser === undefined || (perUser !== null && (perUser <= 0 || !Number.isInteger(perUser)))) {
    return { ok: false, error: '每人使用次數必須是正整數，或留空代表不限' }
  }

  const audience = body.audience
  if (!AUDIENCES.includes(audience as never)) return { ok: false, error: '請選擇適用對象' }
  if (threshold === undefined || (threshold !== null && (threshold <= 0 || !Number.isInteger(threshold)))) {
    return { ok: false, error: '門檻必須是正整數' }
  }
  if ((audience === 'min_orders' || audience === 'min_spend') && threshold === null) {
    return { ok: false, error: '此適用對象必須填寫門檻' }
  }

  const validFrom = optDate(body.valid_from)
  const validUntil = optDate(body.valid_until)
  if (validFrom === undefined || validUntil === undefined) return { ok: false, error: '日期格式無效' }
  const from = validFrom ?? new Date().toISOString()
  if (validUntil && Date.parse(validUntil) <= Date.parse(from)) {
    return { ok: false, error: '結束時間必須遲於開始時間' }
  }

  const status = body.status
  if (!STATUSES.includes(status as never)) return { ok: false, error: '狀態無效' }

  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : null

  return {
    ok: true,
    value: {
      ...(code ? { code } : {}),
      name,
      discount_type: discountType as PromoInput['discount_type'],
      discount_value: value,
      max_discount: discountType === 'percentage' ? maxDiscount : null,
      min_cart_amount: minCart,
      max_uses: maxUses,
      per_user_limit: perUser,
      audience: audience as PromoInput['audience'],
      audience_threshold: audience === 'min_orders' || audience === 'min_spend' ? threshold : null,
      valid_from: from,
      valid_until: validUntil,
      status: status as PromoInput['status'],
      is_active: status === 'active',
    },
  }
}
