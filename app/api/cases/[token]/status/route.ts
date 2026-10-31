import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security/audit-log'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { loadCaseByToken } from '@/lib/cases/service'
import { CASE_PAYMENT_COLUMNS, settleCasePayment, type CasePaymentRow } from '@/lib/cases/settle'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/cases/<token>/status — polled by the pay page after the member returns from KPay.
// Asks KPay about the latest attempt (settleCasePayment marks the case paid when KPay says so).
//   state: paid | pending | needs_review | closed | unknown | none
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = getClientIp(req)
  if (!(await rateLimit('case_status', `ip:${ip}`, 90, 60))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const c = await loadCaseByToken(token)
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (c.status === 'paid') return NextResponse.json({ state: 'paid' })
  if (c.status === 'waived' || c.status === 'cancelled') return NextResponse.json({ state: 'closed' })

  const { data } = await getLegacyServiceSupabase()
    .from('violation_case_payments')
    .select(CASE_PAYMENT_COLUMNS)
    .eq('case_id', c.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const payment = ((data ?? [])[0] as CasePaymentRow | undefined) ?? undefined
  if (!payment) return NextResponse.json({ state: 'none' })

  try {
    const outcome = await settleCasePayment(payment, new URL(req.url).hostname)
    if (outcome === 'paid' || outcome === 'already_paid') return NextResponse.json({ state: 'paid' })
    return NextResponse.json({ state: outcome })
  } catch (e) {
    console.error('[cases/status] settle failed', (e as Error).message)
    return NextResponse.json({ state: 'unknown' })
  }
}
