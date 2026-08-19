// Shared helper — resolves a Space Pilot session from an Authorization: Bearer header.
// Returns the device row if the token is valid and unrevoked; null otherwise.
// All Pilot API routes call this so token validation lives in one place.

import { getServiceSupabase } from '@/lib/supabase/service'

export type PilotSession = {
  sessionId: string
  deviceId: string
  roomCode: string
  roomDisplayName: string
  tableNumber: number
}

export async function resolvePilotSession(authHeader: string | null): Promise<PilotSession | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return null

  const service = getServiceSupabase()
  const { data, error } = await service
    .from('pilot_sessions')
    .select('id, pilot_device_id, pilot_devices(room_code, room_display_name, table_number)')
    .eq('session_token', token)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null

  const dev = Array.isArray(data.pilot_devices) ? data.pilot_devices[0] : data.pilot_devices
  if (!dev) return null

  // Bump last_seen asynchronously — never block the caller on this write.
  service
    .from('pilot_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', data.id)
    .is('revoked_at', null)
    .then(() => null)

  return {
    sessionId: data.id,
    deviceId: data.pilot_device_id,
    roomCode: dev.room_code as string,
    roomDisplayName: dev.room_display_name as string,
    tableNumber: dev.table_number as number,
  }
}
