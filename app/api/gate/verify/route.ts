import { NextResponse } from 'next/server'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { getServiceSupabase } from '@/lib/supabase/service'
import { verifyGatePassword } from '@/lib/gate/password'
import { signGateCookie, GATE_COOKIE_NAME } from '@/lib/gate/cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'
const COOKIE_MAX_AGE = 60 * 60 // 1 hour, matches lib/gate/cookie.ts

// POST /api/gate/verify  { password }
// Public route (site gate is only reachable while the gate itself is active,
// so this must work for anonymous visitors). Rate-limited per IP to blunt
// brute-forcing the gate password.
export async function POST(req: Request) {
  try {
    const ip = clientIp(req)
    const allowed = await rateLimit('gate_verify', `ip:${ip}`, 5, 15 * 60)
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!password) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data: row } = await service
      .from('site_gate_config')
      .select('password_hash, password_salt')
      .eq('id', CONFIG_ID)
      .maybeSingle()

    const hash = row?.password_hash as string | null
    const salt = row?.password_salt as string | null
    const ua = req.headers.get('user-agent') ?? null

    if (!hash || !salt || !(await verifyGatePassword(password, salt, hash))) {
      await service.from('site_gate_access_log').insert({ ip_address: ip, method: 'denied', user_agent: ua })
      return NextResponse.json({ ok: false, error: 'wrong_password' }, { status: 401 })
    }

    const secret = process.env.GATE_COOKIE_SECRET
    if (!secret) {
      console.error('[gate/verify] GATE_COOKIE_SECRET is not set')
      return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
    }

    await service.from('site_gate_access_log').insert({ ip_address: ip, method: 'password', user_agent: ua })

    const cookieValue = await signGateCookie(secret)
    const res = NextResponse.json({ ok: true })
    res.cookies.set(GATE_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    })
    return res
  } catch (err) {
    console.error('[gate/verify] unexpected error', err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 })
  }
}
