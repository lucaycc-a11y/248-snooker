import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { CASE_COLUMNS, casePayUrl, createCase, toCaseRow } from '@/lib/cases/service'
import { isCaseScenario, SCENARIO_LIST } from '@/lib/cases/scenarios'
import { buildCaseWhatsAppDraft, normalizeWhatsAppPhone, whatsAppLink } from '@/lib/cases/whatsapp'

export const dynamic = 'force-dynamic'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

// GET /api/admin/cases?status=open|all|paid|…  — violation cases, newest first, with member labels.
export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = new URL(req.url).searchParams.get('status') ?? 'open'
    const db = getLegacyServiceSupabase()
    let q = db.from('violation_cases').select(CASE_COLUMNS).order('created_at', { ascending: false }).limit(200)
    if (status === 'open') q = q.in('status', ['draft', 'notified', 'overdue'])
    else if (status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const cases = ((data ?? []) as unknown[]).map(toCaseRow).filter((c): c is NonNullable<typeof c> => c !== null)
    const ids = Array.from(new Set(cases.map((c) => c.user_id)))
    const labels = new Map<string, { code: string | null; name: string | null; blacklisted: boolean }>()
    const phones = new Map<string, string | null>()
    if (ids.length > 0) {
      const { data: users } = await db.from('users').select('id, member_code, display_name, is_blacklisted, phone').in('id', ids)
      for (const u of (users ?? []) as unknown[]) {
        if (!isRec(u) || typeof u.id !== 'string') continue
        phones.set(u.id, typeof u.phone === 'string' ? u.phone : null)
        labels.set(u.id, {
          code: typeof u.member_code === 'string' ? u.member_code : null,
          name: typeof u.display_name === 'string' ? u.display_name : null,
          blacklisted: u.is_blacklisted === true,
        })
      }
    }

    // Attempts KPay collected money for but the case could not take (waived meanwhile, duplicate, amount mismatch).
    const review = new Set<string>()
    if (cases.length > 0) {
      const { data: rows } = await db
        .from('violation_case_payments')
        .select('case_id')
        .eq('status', 'needs_review')
        .in('case_id', cases.map((c) => c.id))
      for (const r of (rows ?? []) as unknown[]) if (isRec(r) && typeof r.case_id === 'string') review.add(r.case_id)
    }

    return NextResponse.json({
      cases: cases.map((c) => {
        const { pay_token: _omit, ...rest } = c
        void _omit
        const member = labels.get(c.user_id) ?? null
        const payUrl = casePayUrl(c.pay_token)
        const draft = buildCaseWhatsAppDraft({
          memberName: member?.name ?? '',
          caseNo: c.case_no,
          scenario: c.scenario,
          title: c.title,
          amount: c.amount,
          dueAt: c.due_at,
          payUrl,
          overdue: c.status === 'overdue',
        })
        const phone = phones.get(c.user_id) ?? null
        return {
          ...rest,
          payUrl,
          needsReview: review.has(c.id),
          member,
          whatsappDraft: draft,
          whatsappLink: whatsAppLink(phone, draft),
          hasPhone: normalizeWhatsAppPhone(phone) !== null,
        }
      }),
      scenarios: SCENARIO_LIST,
      canWaive: admin.role === 'super_admin',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}

// POST /api/admin/cases — create a case as a DRAFT. Nothing is sent until the admin picks a channel.
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRec(body)) return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })

    // selfTest: a $1.5 case addressed to the admin's own member account, for trying the whole flow.
    if (body.selfTest === true) {
      const db0 = getLegacyServiceSupabase()
      const { data: me } = await db0.from('users').select('id, email').eq('id', admin.userId).maybeSingle()
      if (!isRec(me) || typeof me.id !== 'string' || typeof me.email !== 'string') {
        return NextResponse.json({ error: '你的管理員帳號沒有對應的會員資料或 email，未能建立測試個案' }, { status: 400 })
      }
      const t = await createCase(
        { userId: me.id, bookingId: null, scenario: 'other', title: '系統測試個案', detail: '這是系統測試個案，用作測試通知及付款流程，請忽略或按指示繳付 HK$1.5。', amount: 1.5, applyBlacklist: false, incidentAt: null },
        { adminId: admin.userId, adminEmail: admin.email },
      )
      if (!t.ok) return NextResponse.json({ error: t.error }, { status: 400 })
      return NextResponse.json({ ok: true, caseNo: t.value.case_no })
    }

    const memberCode = typeof body.memberCode === 'string' ? body.memberCode.trim() : ''
    if (!memberCode) return NextResponse.json({ error: '請輸入會員編號' }, { status: 400 })
    if (!isCaseScenario(body.scenario)) return NextResponse.json({ error: '請選擇違規情境' }, { status: 400 })

    const db = getLegacyServiceSupabase()
    const { data: member } = await db.from('users').select('id').ilike('member_code', memberCode).maybeSingle()
    if (!isRec(member) || typeof member.id !== 'string') return NextResponse.json({ error: `找不到會員 ${memberCode}` }, { status: 404 })

    let bookingId: string | null = null
    const bookingCode = typeof body.bookingCode === 'string' ? body.bookingCode.trim() : ''
    if (bookingCode) {
      const { data: b } = await db.from('bookings').select('id, user_id').ilike('human_code', bookingCode).maybeSingle()
      if (!isRec(b) || b.user_id !== member.id) return NextResponse.json({ error: '找不到此會員的該預約編號' }, { status: 404 })
      bookingId = String(b.id)
    }

    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount)
    const result = await createCase(
      {
        userId: member.id,
        bookingId,
        scenario: body.scenario,
        title: typeof body.title === 'string' ? body.title : undefined,
        detail: typeof body.detail === 'string' ? body.detail : '',
        evidenceNote: typeof body.evidenceNote === 'string' ? body.evidenceNote : undefined,
        amount,
        applyBlacklist: body.applyBlacklist === true,
        incidentAt: typeof body.incidentAt === 'string' && body.incidentAt ? body.incidentAt : null,
        dueDays: typeof body.dueDays === 'number' ? body.dueDays : undefined,
      },
      { adminId: admin.userId, adminEmail: admin.email },
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, caseNo: result.value.case_no })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
