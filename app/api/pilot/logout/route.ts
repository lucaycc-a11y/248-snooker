import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getServiceSupabase } from '@/lib/supabase/service'

type LogoutBody = { session_token?: unknown; password?: unknown }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LogoutBody | null
  const token = typeof body?.session_token === 'string' ? body.session_token : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!token || !password) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const service = getServiceSupabase()
  const { data: session, error: sessionError } = await service
    .from('pilot_sessions')
    .select('id, pilot_device_id, revoked_at')
    .eq('session_token', token)
    .maybeSingle()
  if (sessionError) {
    console.error('[pilot/logout] session lookup failed', sessionError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (!session || session.revoked_at) return NextResponse.json({ error: 'invalid_session' }, { status: 401 })

  const { data: device, error: deviceError } = await service
    .from('pilot_devices')
    .select('password_hash')
    .eq('id', session.pilot_device_id)
    .maybeSingle()
  if (deviceError) {
    console.error('[pilot/logout] device lookup failed', deviceError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  if (!device || !(await bcrypt.compare(password, device.password_hash))) {
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
  }

  const { error: revokeError } = await service
    .from('pilot_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', session.id)
    .is('revoked_at', null)
  if (revokeError) {
    console.error('[pilot/logout] revoke failed', revokeError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
