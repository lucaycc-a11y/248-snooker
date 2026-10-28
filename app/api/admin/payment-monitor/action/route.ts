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
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized — admin only' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { action?: string; orderNo?: string; issueId?: string; mark?: string } | null

  if (body?.action === 'check') {
    if (!isKPayOrderNo(body.orderNo)) return NextResponse.json({ error: '訂單編號無效' }, { status: 400 })
    const state = await getLiveKPayState(body.orderNo)
    return NextResponse.json({ state })
  }

  if (body?.action === 'mark') {
    const issueId = typeof body.issueId === 'string' ? body.issueId.trim() : ''
    if (!issueId || issueId.length > 200) return NextResponse.json({ error: '項目無效' }, { status: 400 })
    if (body.mark !== 'fixed' && body.mark !== 'pending' && body.mark !== 'open') return NextResponse.json({ error: '狀態無效' }, { status: 400 })
    const db = getLegacyServiceSupabase()
    const { error } =
      body.mark === 'open'
        ? await db.from('payment_issue_marks').delete().eq('issue_id', issueId)
        : await db.from('payment_issue_marks').upsert(
            { issue_id: issueId, status: body.mark, marked_by: admin.email, marked_at: new Date().toISOString() },
            { onConflict: 'issue_id' },
          )
    if (error) return NextResponse.json({ error: '儲存失敗，請重試' }, { status: 500 })
    try {
      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'payment_issue_mark',
        targetTable: 'payment_issue_marks',
        afterJsonb: { issueId, mark: body.mark },
      })
    } catch {
      /* audit is best-effort */
    }
    return NextResponse.json({ ok: true })
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
