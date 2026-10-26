/**
 * POST /api/admin/payment-monitor/action
 *   { action: 'check', orderNo }  -> asks KPay live what happened to one order
 *   { action: 'reconcile' }       -> closes out stale attempts; confirms bookings KPay says are paid
 * Auth: getAdminData(). Nothing here moves money.
 */
import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLiveKPayState, isKPayOrderNo } from '@/lib/payments/live-order'
import { reconcileStaleAttempts } from '@/lib/payments/reconcile'
import { writeAdminActionLog } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { action?: string; orderNo?: string } | null

  if (body?.action === 'check') {
    if (!isKPayOrderNo(body.orderNo)) return NextResponse.json({ error: '訂單編號無效' }, { status: 400 })
    const state = await getLiveKPayState(body.orderNo)
    return NextResponse.json({ state })
  }

  if (body?.action === 'reconcile') {
    const items = await reconcileStaleAttempts({ confirmPaid: true, source: 'admin', limit: 80 })
    try {
      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'payment_reconcile',
        targetTable: 'payment_attempts',
        afterJsonb: { handled: items.length, actions: items.map((i) => i.action) },
      })
    } catch {
      /* audit is best-effort */
    }
    return NextResponse.json({ items })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
