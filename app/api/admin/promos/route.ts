/**
 * GET  /api/admin/promos — promotion_codes (the table checkout reads) + real usage
 * POST /api/admin/promos — create a code
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import {
  normalizePromoCodeInput,
  type PromoCodeInput,
} from '@/lib/admin/promo-code-rules'
import type { Json } from '@/lib/supabase/database.types'

export const runtime = 'nodejs'

/**
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
  const [codesRes, usageRes] = await Promise.all([
    service.from('promotion_codes').select('*').order('created_at', { ascending: false }),
    service.from('promo_code_usages').select('promo_code_id, status, discount_amount'),
  ])
  if (codesRes.error || usageRes.error) {
    const message = (codesRes.error ?? usageRes.error)?.message ?? 'unknown'
    console.error('[admin/promos] list failed', message)
    return NextResponse.json({ error: `讀取優惠碼失敗：${message}` }, { status: 500 })
  }

  const usage = new Map<string, { held: number; redeemed: number; discount: number }>()
  for (const u of (usageRes.data ?? []) as Array<{ promo_code_id: string; status: string; discount_amount: number | null }>) {
    const cur = usage.get(u.promo_code_id) ?? { held: 0, redeemed: 0, discount: 0 }
    if (u.status === 'held') cur.held += 1
    if (u.status === 'redeemed') {
      cur.redeemed += 1
      cur.discount += Number(u.discount_amount ?? 0)
    }
    usage.set(u.promo_code_id, cur)
  }

  const codes = (codesRes.data ?? []).map((c) => {
    const row = c as unknown as Record<string, unknown> & { id: string }
    const u = usage.get(row.id) ?? { held: 0, redeemed: 0, discount: 0 }
    return { ...row, usage_held: u.held, usage_redeemed: u.redeemed, usage_discount: u.discount }
  })
  return NextResponse.json({ codes })
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
      .maybeSingle()

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
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: '此優惠碼已存在' }, { status: 409 })
      console.error('[admin/promos] create failed', error)
      return NextResponse.json({ error: `建立失敗：${error.message}` }, { status: 500 })
    }

    await writeAdminAudit({
      adminUserId: admin.userId,
      adminEmail: admin.email,
      action: 'promo_code_created',
      targetTable: 'promotion_codes',
      targetId: (data as { id: string }).id,
      beforeValue: null,
      afterValue: insertBody as unknown as Json,
    })
    return NextResponse.json({ code: data }, { status: 201 })
  } catch (err) {
    console.error('[admin/promos] create crash', err)
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 })
  }
}
