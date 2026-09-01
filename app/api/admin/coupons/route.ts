/**
 * GET  /api/admin/coupons — list coupon_templates (+ per-template issued/used stats)
 * POST /api/admin/coupons — create a coupon template
 *
 * Targets the NEW coupon_templates table (spec §8), NOT the legacy
 * promotion_codes table that the checkout flow still reads. The two systems
 * coexist: this admin UI manages coupon_templates; checkout remains untouched.
 *
 * Auth: getAdminData() guard. All writes log to admin_action_log.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

type CouponRow = Record<string, unknown>

const LIST_COLUMNS =
  'id, name, discount_type, discount_value, max_uses, used_count, valid_from, valid_until, is_active, created_by, created_at'

/** Convert a raw row into a serializable coupon object. */
function serializeCoupon(row: CouponRow) {
  return {
    id: str(row, ['id']),
    name: str(row, ['name']),
    discountType: str(row, ['discount_type']),
    discountValue: num(row, ['discount_value'], 0),
    maxUses: row.max_uses === null ? null : num(row, ['max_uses'], 0),
    usedCount: num(row, ['used_count'], 0),
    validFrom: str(row, ['valid_from']),
    validUntil: str(row, ['valid_until']),
    isActive: row.is_active === true,
    createdBy: str(row, ['created_by']),
    createdAt: str(row, ['created_at']),
  }
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('coupon_templates')
      .select(LIST_COLUMNS)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[coupons] list_failed', { message: error.message })
      return NextResponse.json({ error: 'Failed to list coupons' }, { status: 500 })
    }

    const rows = (data ?? []) as CouponRow[]

    // Per-template issued count (user_coupons rows) for the list badge.
    const { data: issued } = await service
      .from('user_coupons')
      .select('coupon_template_id')

    const issuedCount = new Map<string, number>()
    for (const u of (issued ?? []) as CouponRow[]) {
      const tid = str(u, ['coupon_template_id'])
      if (tid) issuedCount.set(tid, (issuedCount.get(tid) ?? 0) + 1)
    }

    const coupons = rows.map((r) => ({
      ...serializeCoupon(r),
      issuedCount: issuedCount.get(str(r, ['id']) ?? '') ?? 0,
    }))

    return NextResponse.json({ coupons })
  } catch (err) {
    const e = err as Error
    console.error('[coupons] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const raw = (body ?? {}) as Record<string, unknown>

    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    const discountType = typeof raw.discountType === 'string' ? raw.discountType : ''
    const discountValue = typeof raw.discountValue === 'number' ? raw.discountValue : NaN
    const validUntil = typeof raw.validUntil === 'string' ? raw.validUntil : ''
    const maxUses = raw.maxUses == null ? null : Number(raw.maxUses)
    const validFrom = typeof raw.validFrom === 'string' && raw.validFrom ? raw.validFrom : new Date().toISOString()

    if (!name || name.length > 120) {
      return NextResponse.json({ error: 'Name is required (max 120 chars)' }, { status: 400 })
    }
    if (discountType !== 'percentage' && discountType !== 'fixed') {
      return NextResponse.json({ error: 'discountType must be "percentage" or "fixed"' }, { status: 400 })
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return NextResponse.json({ error: 'discountValue must be a positive number' }, { status: 400 })
    }
    if (discountType === 'percentage' && discountValue > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot exceed 100' }, { status: 400 })
    }
    if (!validUntil || Number.isNaN(Date.parse(validUntil))) {
      return NextResponse.json({ error: 'validUntil is required and must be a valid date' }, { status: 400 })
    }
    if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses <= 0)) {
      return NextResponse.json({ error: 'maxUses must be a positive integer or null' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const payload: Record<string, unknown> = {
      name,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses === null ? null : Math.floor(maxUses),
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: true,
      created_by: admin.userId,
    }

    const { data: inserted, error } = await service
      .from('coupon_templates')
      .insert(payload)
      .select(LIST_COLUMNS)
      .single()

    if (error) {
      console.error('[coupons] create_failed', { message: error.message })
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'coupon_template_created',
      target_table: 'coupon_templates',
      target_id: (inserted as CouponRow | null)?.id ? str(inserted as CouponRow, ['id']) : null,
      after_jsonb: {
        name,
        discount_type: discountType,
        discount_value: discountValue,
        max_uses: maxUses,
        valid_until: validUntil,
      },
      risk_level: 'low',
    })

    return NextResponse.json({ coupon: serializeCoupon(inserted as CouponRow) }, { status: 201 })
  } catch (err) {
    const e = err as Error
    console.error('[coupons] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
