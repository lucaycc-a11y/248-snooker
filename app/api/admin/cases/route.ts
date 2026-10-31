import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { CASE_COLUMNS, casePayUrl, createAndNotifyCase, toCaseRow } from '@/lib/cases/service'
import { isCaseScenario, SCENARIO_LIST } from '@/lib/cases/scenarios'

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
    if (ids.length > 0) {
      const { data: users } = await db.from('users').select('id, member_code, display_name, is_blacklisted').in('id', ids)
      for (const u of (users ?? []) as unknown[]) {
        if (!isRec(u) || typeof u.id !== 'string') continue
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
        return { ...rest, payUrl: casePayUrl(c.pay_token), needsReview: review.has(c.id), member: labels.get(c.user_id) ?? null }
      }),
      scenarios: SCENARIO_LIST,
      canWaive: admin.role === 'super_admin',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}

// POST /api/admin/cases — create a case and send the notice (email + inbox, optional blacklist).
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRec(body)) return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })

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
    const result = await createAndNotifyCase(
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
    return NextResponse.json({ ok: true, caseNo: result.value.case.case_no, blacklisted: result.value.blacklisted })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
