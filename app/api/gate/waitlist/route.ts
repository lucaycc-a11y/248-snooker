import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCES = new Set(['maintenance', 'kpay'])

// POST /api/gate/waitlist  { email, source? }
// Public route — collects pre-launch waitlist emails from the coming-soon page.
export async function POST(req: Request) {
  try {
    const allowed = await rateLimit('gate_waitlist', `ip:${clientIp(req)}`, 5, 60 * 60)
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
    }

    const source = typeof body?.source === 'string' && SOURCES.has(body.source) ? body.source : 'maintenance'

    const service = getServiceSupabase()
    const { error } = await service.rpc('waitlist_add', { p_email: email, p_source: source })
    if (error) {
      console.error('[gate/waitlist] insert failed', error)
      return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[gate/waitlist] unexpected error', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
