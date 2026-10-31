import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { closeCase, casePayUrl, loadCase, notifyCase } from '@/lib/cases/service'
import { buildDemandLetter } from '@/lib/cases/demand-letter'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

// POST /api/admin/cases/<id>  { action: 'resend' | 'waive' | 'cancel', reason? }
//   resend — send the notice email again (also nudges an overdue case)
//   cancel — opened by mistake (any admin)
//   waive  — forgive the fee (super_admin only: it gives money away)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const body: unknown = await req.json().catch(() => null)
    const rec = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const action = rec.action
    const reason = typeof rec.reason === 'string' ? rec.reason : ''
    const actor = { adminId: admin.userId, adminEmail: admin.email }

    if (action === 'resend') {
      const r = await notifyCase(id, actor)
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
    }
    if (action === 'cancel' || action === 'waive') {
      if (action === 'waive' && admin.role !== 'super_admin') {
        return NextResponse.json({ error: '只有 super admin 可以豁免費用' }, { status: 403 })
      }
      const r = await closeCase(id, action, reason, actor)
      return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}

// GET /api/admin/cases/<id>  — formal demand letter draft (text only, nothing is sent).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    const c = await loadCase(id)
    if (!c) return NextResponse.json({ error: '找不到個案' }, { status: 404 })
    if (c.amount <= 0 || (c.status !== 'notified' && c.status !== 'overdue')) {
      return NextResponse.json({ error: '只有待繳付或已逾期的收費個案可以草擬追討信' }, { status: 400 })
    }
    const { data: u } = await getLegacyServiceSupabase().from('users').select('member_code, display_name').eq('id', c.user_id).maybeSingle()
    const m = typeof u === 'object' && u !== null ? (u as Record<string, unknown>) : {}
    const letter = buildDemandLetter({
      memberName: typeof m.display_name === 'string' ? m.display_name : '',
      memberCode: typeof m.member_code === 'string' ? m.member_code : null,
      caseNo: c.case_no,
      scenario: c.scenario,
      title: c.title,
      detail: c.detail,
      incidentAt: c.incident_at,
      amount: c.amount,
      payUrl: casePayUrl(c.pay_token),
    })
    return NextResponse.json({ letter })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
