import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : ''
  if (!token) return NextResponse.json({ valid: false })

  const service = getServiceSupabase()
  const { data: session, error } = await service
    .from('pilot_sessions')
    .select('id, pilot_device_id, pilot_devices(room_code, room_display_name)')
    .eq('session_token', token)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) {
    console.error('[pilot/session] session lookup failed', error)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  if (!session) return NextResponse.json({ valid: false })

  const { error: updateError } = await service
    .from('pilot_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id)
    .is('revoked_at', null)
  if (updateError) {
    console.error('[pilot/session] last_seen update failed', updateError)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const device = Array.isArray(session.pilot_devices) ? session.pilot_devices[0] : session.pilot_devices
  if (!device) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, room_code: device.room_code, room_display_name: device.room_display_name })
}
