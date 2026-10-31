import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/security/audit-log'
import { loadCaseByToken } from '@/lib/cases/service'
import { startCasePayment } from '@/lib/cases/pay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cases/<token>/pay  { mode?: 'web' | 'h5' }
// Opens (or resumes) the KPay hosted cashier for a violation case. The 192-bit token in the
// emailed link is the credential: no login is needed to pay a fee, and the token never reveals
// anything beyond the one case. Rate limited per IP and per token.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const ip = getClientIp(req)
  if (!(await rateLimit('case_pay_ip', `ip:${ip}`, 20, 60)) || !(await rateLimit('case_pay_token', `token:${token.slice(0, 12)}`, 10, 60))) {
    return NextResponse.json({ error: '操作太頻繁，請稍後再試' }, { status: 429 })
  }

  const c = await loadCaseByToken(token)
  if (!c) return NextResponse.json({ error: '連結無效' }, { status: 404 })

  let mode: 'web' | 'h5' = 'h5'
  try {
    const body: unknown = await req.json()
    if (typeof body === 'object' && body !== null && (body as Record<string, unknown>).mode === 'web') mode = 'web'
  } catch {
    // no body = mobile default
  }

  const result = await startCasePayment(c, new URL(req.url).hostname, mode)
  if (!result.ok) {
    const status = result.code === 'not_payable' || result.code === 'amount' ? 409 : result.code === 'busy' ? 429 : 502
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }
  return NextResponse.json({ payUrl: result.payUrl, existing: result.existing })
}
