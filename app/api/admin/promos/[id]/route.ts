/**
 * PATCH /api/admin/promos/[id] — edit a code, or enable/disable it.
 * There is no DELETE: usage history references the code, so a code is disabled, never removed.
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import {
  normalizePromoCodeInput,
  PROMO_CODE_PATTERN,
  type PromoCodeInput,
} from '@/lib/admin/promo-code-rules'
import type { Json } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'

function asOptionalInput(body: Record<string, unknown>, current: Record<string, unknown>): PromoCodeInput {
  const pick = (key: string, fallback: unknown): unknown =>
    key in body ? body[key] : fallback
  return {
    code: typeof pick('code', current.code) === 'string' ? String(pick('code', current.code)) : '',
    name: typeof pick('name', current.name) === 'string' ? String(pick('name', current.name)) : '',
    discountType: typeof pick('discount_type', current.discount_type) === 'string' ? String(pick('discount_type', current.discount_type)) : '',
    discountValue: pick('discount_value', current.discount_value),
    status: typeof pick('status', current.status) === 'string' ? String(pick('status', current.status)) : '',
    audience: typeof pick('audience', current.audience) === 'string' ? String(pick('audience', current.audience)) : '',
    audienceThreshold: pick('audience_threshold', current.audience_threshold),
    maxUses: pick('max_uses', current.max_uses),
    perUserLimit: pick('per_user_limit', current.per_user_limit),
    minCartAmount: pick('min_cart_amount', current.min_cart_amount),
    maxDiscount: pick('max_discount', current.max_discount),
    validFrom: typeof pick('valid_from', current.valid_from) === 'string' ? String(pick('valid_from', current.valid_from)) : null,
    validUntil: typeof pick('valid_until', current.valid_until) === 'string' ? String(pick('valid_until', current.valid_until)) : null,
    stackableWithCredits: pick('stackable_with_credits', current.stackable_with_credits),
    stackableWithOtherCodes: pick('stackable_with_other_codes', current.stackable_with_other_codes),
    weekdays: pick('weekdays', current.weekdays),
    timeWindows: pick('time_windows', current.time_windows),
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body: unknown = await req.json().catch(() => null)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const service = getLegacyServiceSupabase()

    const { data: before, error: readErr } = await service
      .from('promotion_codes')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
    if (!before) return NextResponse.json({ error: '找不到優惠碼' }, { status: 404 })

    const current = before as unknown as Record<string, unknown>
    const rec = body as Record<string, unknown>

    let updates: Record<string, unknown>
    // Fast path: a pure enable / disable only flips status + is_active and does
    // not need the full create-form validation (a draft may legitimately have
    // no valid_until yet).
    const keys = Object.keys(rec)
    const onlyStatus = keys.length > 0 && keys.every((k) => k === 'status' || k === 'is_active')
    if (onlyStatus && typeof rec.status === 'string') {
      const status = rec.status
      if (!['draft', 'active', 'disabled'].includes(status)) {
        return NextResponse.json({ error: '狀態必須為草稿、生效或停用' }, { status: 400 })
      }
      updates = { status, is_active: status === 'active' }
    } else {
      const normalized = normalizePromoCodeInput(asOptionalInput(rec, current))
      if (!normalized.ok) {
        return NextResponse.json({ error: normalized.error }, { status: 400 })
      }

      const v = normalized.value
      if (v.code !== String(current.code ?? '').toUpperCase() && !PROMO_CODE_PATTERN.test(v.code)) {
        return NextResponse.json({ error: '優惠碼格式無效' }, { status: 400 })
      }

      updates = {
        code: v.code,
        name: v.name || null,
        discount_type: v.discountType,
        discount_value: v.discountValue,
        // `prepare_checkout` reports 'inactive' — write both columns so whichever
        // one the RPC tests, the admin's intent is what the customer sees.
        status: v.status,
        is_active: v.status === 'active',
        audience: v.audience,
        audience_threshold: v.audienceThreshold,
        max_uses: v.maxUses,
        per_user_limit: v.perUserLimit,
        min_cart_amount: v.minCartAmount,
        max_discount: v.maxDiscount,
        valid_from: v.validFrom,
        valid_until: v.validUntil,
        stackable_with_credits: v.stackableWithCredits,
        stackable_with_other_codes: v.stackableWithOtherCodes,
        // `prepare_checkout` reads these as `extract(isodow …) = ANY (weekdays)`
        // and `jsonb_array_elements(time_windows) ->> 'start'/'end'`.
        weekdays: v.weekdays,
        time_windows: v.timeWindows,
      }
    }

    const { data, error } = await service
      .from('promotion_codes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '該優惠碼已存在' }, { status: 409 })
      }
      console.error('[admin/promos] update failed', error)
      return NextResponse.json({ error: `更新失敗：${error.message}` }, { status: 500 })
    }

    await writeAdminAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'promo_code_updated',
      targetTable: 'promotion_codes',
      targetId: id,
      beforeValue: before as unknown as Json,
      afterValue: updates as unknown as Json,
    })
    return NextResponse.json({ code: data })
  } catch (err) {
    console.error('[admin/promos] update crash', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}

export async function DELETE() {
  // Never delete — see the file header. Disable the code instead.
  return NextResponse.json(
    { error: '優惠碼不能刪除，請改為停用' },
    { status: 405, headers: { Allow: 'PATCH' } }
  )
}
