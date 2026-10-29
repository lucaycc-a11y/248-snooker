import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { settlePaymentXOrder, loadPaymentXOrder } from '@/lib/paymentx/settle'
import { PAYMENTX_CHANGELOG, PAYMENTX_VERSION } from '@/lib/paymentx/version'
import { PaymentXClient } from '@/lib/paymentx/client'

// 後台 → 設定 → PaymentX. Which accounts see the hosted cashier, the latest PaymentX orders
// and KPay notify payloads. Any signed-in admin may read and manage the test list.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const db = getLegacyServiceSupabase()

    const { data: testerRows, error: testerErr } = await db
      .from('paymentx_testers')
      .select('user_id, note, added_by, created_at')
      .order('created_at', { ascending: false })
    if (testerErr) throw testerErr

    const ids = ((testerRows ?? []) as Row[]).map((r) => String(r.user_id))
    let users = new Map<string, Row>()
    if (ids.length > 0) {
      const { data } = await db.from('users').select('id, email, display_name, member_code').in('id', ids)
      users = new Map(((data ?? []) as Row[]).map((u) => [String(u.id), u]))
    }
    const testers = ((testerRows ?? []) as Row[]).map((r) => {
      const u = users.get(String(r.user_id))
      return {
        userId: String(r.user_id),
        email: u ? str(u, ['email']) : null,
        displayName: u ? str(u, ['display_name']) : null,
        memberCode: u ? str(u, ['member_code']) : null,
        note: str(r, ['note']),
        addedBy: str(r, ['added_by']),
        createdAt: str(r, ['created_at']),
      }
    })

    const { data: orderRows } = await db
      .from('paymentx_orders')
      .select('id, booking_id, user_id, managed_out_trade_no, managed_order_no, amount, status, paid_order_no, failure_reason, is_test, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(25)
    const orders = (orderRows ?? []) as Row[]
    const bookingIds = orders.map((o) => String(o.booking_id))
    let bookingStatus = new Map<string, string>()
    if (bookingIds.length > 0) {
      const { data } = await db.from('bookings').select('id, status').in('id', bookingIds)
      bookingStatus = new Map(((data ?? []) as Row[]).map((b) => [String(b.id), String(b.status)]))
    }

    const { data: eventRows } = await db
      .from('paymentx_events')
      .select('id, created_at, kind, note, managed_order_no, payload')
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      version: PAYMENTX_VERSION,
      changelog: PAYMENTX_CHANGELOG,
      testers,
      orders: orders.map((o) => ({
        id: String(o.id),
        bookingId: String(o.booking_id),
        bookingStatus: bookingStatus.get(String(o.booking_id)) ?? null,
        code: str(o, ['managed_out_trade_no']),
        managedOrderNo: str(o, ['managed_order_no']),
        amount: Number(o.amount),
        status: String(o.status),
        paidOrderNo: str(o, ['paid_order_no']),
        failureReason: str(o, ['failure_reason']),
        isTest: o.is_test === true,
        createdAt: str(o, ['created_at']),
        updatedAt: str(o, ['updated_at']),
      })),
      events: eventRows ?? [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[admin/paymentx] GET failed', message)
    return NextResponse.json({ error: `PaymentX 資料載入失敗：${message}` }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.action !== 'string') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const db = getLegacyServiceSupabase()

    // Find an account to add: by email, name or member code.
    if (body.action === 'search') {
      const q = typeof body.q === 'string' ? body.q.replace(/[,()%*\\]/g, ' ').trim() : ''
      if (q.length < 2) return NextResponse.json({ users: [] })
      const { data } = await db
        .from('users')
        .select('id, email, display_name, member_code')
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,member_code.ilike.%${q}%`)
        .limit(8)
      return NextResponse.json({
        users: ((data ?? []) as Row[]).map((u) => ({
          userId: String(u.id),
          email: str(u, ['email']),
          displayName: str(u, ['display_name']),
          memberCode: str(u, ['member_code']),
        })),
      })
    }

    if (body.action === 'add' || body.action === 'remove') {
      const userId = typeof body.userId === 'string' ? body.userId : ''
      if (!UUID_RE.test(userId)) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })

      if (body.action === 'add') {
        const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) : null
        const { error } = await db
          .from('paymentx_testers')
          .upsert({ user_id: userId, note: note || null, added_by: admin.email }, { onConflict: 'user_id' })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await db.from('paymentx_testers').delete().eq('user_id', userId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: `paymentx.tester_${body.action}`,
        targetTable: 'paymentx_testers',
        targetId: userId,
        afterJsonb: { userId },
      })
      return NextResponse.json({ ok: true })
    }

    // Fresh signed cashier URL for an open order, in either layout, to isolate cashier problems
    // (blank page on one layout, etc.). Admin only; the URL is signed for 'now'.
    if (body.action === 'cashier_url') {
      const orderId = typeof body.orderId === 'string' ? body.orderId : ''
      if (!UUID_RE.test(orderId)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const order = await loadPaymentXOrder(orderId)
      if (!order || !order.managed_order_no) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })
      const layout = body.layout === 'h5' ? 'h5' : 'web'
      const url = new PaymentXClient(new URL(req.url).hostname).buildCashierUrl(order.managed_order_no, layout)
      return NextResponse.json({ ok: true, url, layout })
    }

    // Ask KPay about one order now and settle it (what the status poll / notify would do).
    if (body.action === 'sync') {
      const orderId = typeof body.orderId === 'string' ? body.orderId : ''
      if (!UUID_RE.test(orderId)) return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 })
      const order = await loadPaymentXOrder(orderId)
      if (!order) return NextResponse.json({ error: '找不到訂單' }, { status: 404 })
      const outcome = await settlePaymentXOrder(order, 'admin', new URL(req.url).hostname)
      return NextResponse.json({ ok: true, outcome })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[admin/paymentx] POST failed', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
