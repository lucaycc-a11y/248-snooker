import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminActionLog } from '@/lib/admin/audit'
import {
  normalizePromoCodeInput,
  type PromoCodeInput,
} from '@/lib/admin/promo-code-rules'

/**
 * GET  /api/admin/promos        — list promotion_codes (checkout-facing codes).
 * POST /api/admin/promos        — create one. Never deletes; see [id]/route.ts.
 *
 * This is the `promotion_codes` system the checkout RPC `prepare_checkout`
 * reads. It is NOT `coupon_templates` / `user_coupons` — those are a separate
 * feature and are untouched here.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readInput(body: Record<string, unknown>): PromoCodeInput {
  return {
    code: typeof body.code === 'string' ? body.code : '',
    name: typeof body.name === 'string' ? body.name : '',
    discountType: typeof body.discount_type === 'string' ? body.discount_type : '',
    discountValue: body.discount_value,
    status: typeof body.status === 'string' ? body.status : '',
    audience: typeof body.audience === 'string' ? body.audience : '',
    audienceThreshold: body.audience_threshold,
    maxUses: body.max_uses,
    perUserLimit: body.per_user_limit,
    minCartAmount: body.min_cart_amount,
    maxDiscount: body.max_discount,
    validFrom: typeof body.valid_from === 'string' ? body.valid_from : null,
    validUntil: typeof body.valid_until === 'string' ? body.valid_until : null,
    stackableWithCredits: body.stackable_with_credits,
    stackableWithOtherCodes: body.stackable_with_other_codes,
    weekdays: body.weekdays,
    timeWindows: body.time_windows,
  }
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getLegacyServiceSupabase()
  const { data, error } = await service
    .from('promotion_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/promos] list failed', error)
    return NextResponse.json({ error: '優惠碼資料載入失敗' }, { status: 500 })
  }
  return NextResponse.json({ codes: data ?? [] })
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const normalized = normalizePromoCodeInput(readInput(body))
    if (!normalized.ok) {
      return NextResponse.json({ error: normalized.error }, { status: 400 })
    }

    const service = getLegacyServiceSupabase()

    const { data: adminUser } = await service
      .from('admin_users')
      .select('id')
      .eq('email', admin.email)
      .single()

    const v = normalized.value
    const insertBody: Record<string, unknown> = {
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
      created_by: adminUser?.id ?? null,
    }

    const { data, error } = await service
      .from('promotion_codes')
      .insert(insertBody)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '該優惠碼已存在' }, { status: 409 })
      }
      console.error('[admin/promos] create failed', error)
      return NextResponse.json({ error: '優惠碼建立失敗' }, { status: 500 })
    }

    // Audit goes through the one helper that throws on failure — a promo code
    // that exists with no audit row is a silent gap.
    await writeAdminActionLog({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      actionType: 'promo_code_created',
      targetTable: 'promotion_codes',
      targetId: String((data as { id?: unknown }).id ?? ''),
      beforeJsonb: null,
      afterJsonb: insertBody as Record<string, unknown>,
    })

    return NextResponse.json({ code: data })
  } catch (err) {
    console.error('[admin/promos] create crash', err)
    return NextResponse.json({ error: '優惠碼建立失敗' }, { status: 500 })
  }
}
