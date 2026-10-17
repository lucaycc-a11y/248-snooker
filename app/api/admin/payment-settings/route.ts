/**
 * Admin payment method settings API.
 *
 * GET: list every known method and its enabled flag.
 * POST: upsert `payment_settings` for one method.
 *
 * Design system: admin-theme.css variables only.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { PAYMENT_METHODS } from '@/lib/payments/methods'

export const dynamic = 'force-dynamic'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceSupabase()
    const { data, error } = await supabase.from('payment_settings').select('method, enabled')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const enabledMap = new Map<string, boolean>()
    for (const row of data ?? []) {
      enabledMap.set(row.method, row.enabled)
    }

    return NextResponse.json({
      methods: PAYMENT_METHODS.map((m) => ({
        ...m,
        // A missing row means the method is offered (see getPaymentMethodSettings).
        enabled: enabledMap.has(m.method) ? enabledMap.get(m.method) : true,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    if (!isRecord(body) || typeof body.method !== 'string' || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'method and enabled are required' }, { status: 400 })
    }

    const method = body.method
    const enabled = body.enabled

    const known = PAYMENT_METHODS.some((m) => m.method === method)
    if (!known) return NextResponse.json({ error: 'Unknown payment method' }, { status: 400 })

    // Never let the last method be turned off — checkout would have nothing to offer.
    if (!enabled) {
      const supabase = getServiceSupabase()
      const { data: rows } = await supabase.from('payment_settings').select('method, enabled')
      const stillOn = (rows ?? []).filter((r) => r.method !== method && r.enabled)
      const knownWithoutRow = PAYMENT_METHODS.filter(
        (m) => m.method !== method && !(rows ?? []).some((r) => r.method === m.method),
      )
      if (stillOn.length + knownWithoutRow.length === 0) {
        return NextResponse.json({ error: '至少要保留一種付款方式' }, { status: 400 })
      }
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('payment_settings')
      .upsert({ method, enabled }, { onConflict: 'method' })
      .select('method, enabled')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await getLegacyServiceSupabase().from('audit_log').insert({
      action: 'payment_settings.toggle',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'payment_settings',
      target_id: method,
      before_value: null,
      after_value: { enabled },
    })

    return NextResponse.json({ ok: true, method: data })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
