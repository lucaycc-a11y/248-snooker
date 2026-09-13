// GET  /api/uat/test-pricing — the currently active test-price override
// POST /api/uat/test-pricing — set a new active override (admin-only)
//
// UAT shares the production KPay merchant account, so is_test bookings charge
// real money. This route controls how much. Every mutation is audit-logged.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { requireActiveAdmin, getClientIp } from '@/lib/uat/admin-auth'
import { getActiveTestPrice } from '@/lib/uat/test-pricing'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await requireActiveAdmin(supabase)
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const active = await getActiveTestPrice(getServiceSupabase())
    return NextResponse.json({ active })
  } catch (error) {
    console.error('[uat/test-pricing] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const auth = await requireActiveAdmin(supabase)
    if (!auth.isAdmin) {
      return NextResponse.json({ error: auth.error }, { status: 403 })
    }

    const body: unknown = await req.json().catch(() => null)
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const { mode, amount, label } = body as Record<string, unknown>

    if (mode !== 'flat' && mode !== 'per_hour') {
      return NextResponse.json({ error: 'mode must be "flat" or "per_hour"' }, { status: 400 })
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
    }
    // KPay cannot create a zero-amount order, so 0 would silently become the
    // HK$1 floor at charge time. Reject it here instead of accepting a value we
    // know will not be honoured.
    if (amount < 1) {
      return NextResponse.json(
        { error: 'amount must be at least 1 — KPay rejects zero-amount orders' },
        { status: 400 },
      )
    }
    if (label !== undefined && label !== null && typeof label !== 'string') {
      return NextResponse.json({ error: 'label must be a string' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Captured before the flip so audit_log records a real before/after pair.
    const before = await getActiveTestPrice(service)

    // Single transaction: deactivate the old row + insert the new active row.
    const { data, error } = await service.rpc('set_uat_test_price', {
      p_mode: mode,
      p_amount: amount,
      p_label: typeof label === 'string' && label.trim() !== '' ? label.trim().slice(0, 200) : null,
      p_updated_by: auth.user.id,
    })

    if (error) {
      console.error('[uat/test-pricing] set_uat_test_price failed', { message: error.message })
      return NextResponse.json({ error: 'Could not set test price' }, { status: 500 })
    }

    const row = data as { id?: unknown; mode?: unknown; amount?: unknown } | null
    const newId = typeof row?.id === 'string' ? row.id : null

    await service.from('audit_log').insert({
      admin_user_id: auth.user.id,
      admin_email: auth.user.email,
      action: 'set_uat_test_price',
      target_table: 'uat_test_pricing',
      target_id: newId,
      before_value: before
        ? { mode: before.mode, amount: before.amount, label: before.label, id: before.id }
        : { active: null },
      after_value: { mode, amount, label: label ?? null, id: newId },
      ip_address: getClientIp(req),
    })

    const active = await getActiveTestPrice(service)
    return NextResponse.json({ success: true, active })
  } catch (error) {
    console.error('[uat/test-pricing] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
