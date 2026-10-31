import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { closeCase, casePayUrl, loadCase, notifyCase, whatsappForCase } from '@/lib/cases/service'
import { findTermsAcceptance } from '@/lib/legal/terms-acceptance'
import { buildDemandLetter } from '@/lib/cases/demand-letter'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

// POST /api/admin/cases/<id>  { action: 'resend' | 'notify_whatsapp' | 'waive' | 'cancel', reason? }
//   resend — send the notice email (first send for a draft, or again for an open case)
//   notify_whatsapp — mark the case notified (starts the clock, applies blacklist) and return the
//                     WhatsApp text + link; the admin sends the message themselves
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
    if (action === 'notify_whatsapp') {
      const r = await notifyCase(id, actor, 'whatsapp')
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
      const w = await whatsappForCase(id)
      return w.ok ? NextResponse.json({ ok: true, whatsappDraft: w.value.draft, whatsappLink: w.value.link, hasPhone: w.value.hasPhone }) : NextResponse.json({ ok: true })
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
    let bookingCode: string | null = null
    if (c.booking_id) {
      const { data: b } = await getLegacyServiceSupabase().from('bookings').select('human_code').eq('id', c.booking_id).maybeSingle()
      const br = typeof b === 'object' && b !== null ? (b as Record<string, unknown>) : {}
      bookingCode = typeof br.human_code === 'string' ? br.human_code : null
    }
    const acceptance = await findTermsAcceptance(c.user_id, c.incident_at ?? c.created_at)
    const letter = buildDemandLetter({
      bookingCode,
      notifiedAt: c.notified_at,
      termsAcceptedAt: acceptance?.acceptedAt ?? null,
      termsVersion: acceptance?.version ?? null,
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
    return NextResponse.json({ letter, termsOnRecord: acceptance !== null })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
