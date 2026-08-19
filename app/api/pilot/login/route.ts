import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { getServiceSupabase } from '@/lib/supabase/service'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INVALID_CREDENTIALS = '房號或密碼不正確'

type LoginBody = { room_code?: unknown; password?: unknown }

export async function POST(request: Request) {
  const ip = clientIp(request)
  if (!(await rateLimit('pilot_login', `ip:${ip}`, 5, 60))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null
  const roomCode = typeof body?.room_code === 'string' ? body.room_code.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!roomCode || !password) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 })
  }

  const service = getServiceSupabase()
  const { data: device, error: deviceError } = await service
    .from('pilot_devices')
    .select('id, room_code, room_display_name, password_hash')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (deviceError) {
    console.error('[pilot/login] device lookup failed', deviceError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const valid = device ? await bcrypt.compare(password, device.password_hash) : false
  if (!valid || !device) {
    return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 })
  }

  const sessionToken = crypto.randomBytes(32).toString('hex')
  const { error: insertError } = await service.from('pilot_sessions').insert({
    pilot_device_id: device.id,
    session_token: sessionToken,
  })
  if (insertError) {
    console.error('[pilot/login] session insert failed', insertError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  return NextResponse.json({
    session_token: sessionToken,
    room_code: device.room_code,
    room_display_name: device.room_display_name,
    table_number: (device as { table_number?: number }).table_number ?? null,
  })
}
