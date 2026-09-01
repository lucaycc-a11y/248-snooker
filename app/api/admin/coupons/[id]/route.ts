/**
 * PATCH  /api/admin/coupons/[id] — toggle active / update fields
 * DELETE /api/admin/coupons/[id] — soft-disable (set is_active=false, never hard delete)
 *
 * Auth: getAdminData() guard. All writes log to admin_action_log.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { str } from '@/lib/data/adminReadHelpers'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }
type CouponRow = Record<string, unknown>

const SELECT_COLS = 'id, name, discount_type, discount_value, max_uses, used_count, valid_from, valid_until, is_active, created_by, created_at'

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    const raw = (body ?? {}) as Record<string, unknown>

    const service = getServiceSupabase()

    // Fetch existing row for before_jsonb snapshot
    const { data: existing, error: fetchErr } = await service
      .from('coupon_templates')
      .select('id, is_active, max_uses, valid_until')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (typeof raw.isActive === 'boolean') {
      update.is_active = raw.isActive
    }
    if (typeof raw.maxUses === 'number' || raw.maxUses === null) {
      update.max_uses = raw.maxUses === null ? null : Math.floor(Number(raw.maxUses))
    }
    if (typeof raw.validUntil === 'string' && raw.validUntil) {
      if (Number.isNaN(Date.parse(raw.validUntil))) {
        return NextResponse.json({ error: 'Invalid validUntil date' }, { status: 400 })
      }
      update.valid_until = raw.validUntil
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await service
      .from('coupon_templates')
      .update(update)
      .eq('id', id)
      .select(SELECT_COLS)
      .single()

    if (error) {
      console.error('[coupons/[id]] patch_failed', { id, message: error.message })
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'coupon_template_updated',
      target_table: 'coupon_templates',
      target_id: id,
      before_jsonb: {
        is_active: existing.is_active,
        max_uses: existing.max_uses,
        valid_until: existing.valid_until,
      },
      after_jsonb: update,
      risk_level: 'medium',
    })

    const row = updated as CouponRow
    return NextResponse.json({
      coupon: {
        id: str(row, ['id']),
        name: str(row, ['name']),
        discountType: str(row, ['discount_type']),
        discountValue: Number(row.discount_value ?? 0),
        maxUses: row.max_uses === null ? null : Number(row.max_uses),
        usedCount: Number(row.used_count ?? 0),
        validFrom: str(row, ['valid_from']),
        validUntil: str(row, ['valid_until']),
        isActive: row.is_active === true,
        createdBy: str(row, ['created_by']),
        createdAt: str(row, ['created_at']),
      },
    })
  } catch (err) {
    const e = err as Error
    console.error('[coupons/[id]] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })
    }

    const { id } = await params

    const service = getServiceSupabase()

    // Fetch existing for before_jsonb
    const { data: existing, error: fetchErr } = await service
      .from('coupon_templates')
      .select('id, is_active')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    // Soft-disable — never hard delete coupon templates
    const { error } = await service
      .from('coupon_templates')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      console.error('[coupons/[id]] delete_failed', { id, message: error.message })
      return NextResponse.json({ error: 'Failed to deactivate coupon' }, { status: 500 })
    }

    await service.from('admin_action_log').insert({
      admin_id: admin.userId,
      admin_email: admin.email,
      action_type: 'coupon_template_deactivated',
      target_table: 'coupon_templates',
      target_id: id,
      before_jsonb: { is_active: existing.is_active },
      after_jsonb: { is_active: false },
      risk_level: 'medium',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const e = err as Error
    console.error('[coupons/[id]] error', { message: e.message, stack: e.stack })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
