import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, readJson, isRecord, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// iOS push registration.
//   POST   { token, environment?: 'production'|'sandbox', locale?, appVersion?, enabled?, prefs? }
//          Upserts this device for the signed-in admin (call on every launch).
//   DELETE { token }  Call on sign-out so the device stops receiving alerts.
export const dynamic = 'force-dynamic'

const TOKEN_RE = /^[0-9a-fA-F]{32,200}$/

export async function POST(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const body = await readJson(req)
  if (!body) return jsonError('Invalid JSON body')

  const token = typeof body.token === 'string' ? body.token.trim().toLowerCase() : ''
  if (!TOKEN_RE.test(token)) return jsonError('Invalid device token')
  const environment = body.environment === 'sandbox' ? 'sandbox' : 'production'

  const row: Record<string, unknown> = {
    user_id: g.admin.userId,
    token,
    platform: 'ios',
    environment,
    updated_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
  }
  if (typeof body.locale === 'string') row.locale = body.locale.slice(0, 16)
  if (typeof body.appVersion === 'string') row.app_version = body.appVersion.slice(0, 32)
  if (typeof body.enabled === 'boolean') row.enabled = body.enabled
  if (isRecord(body.prefs)) {
    const prefs: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(body.prefs)) if (typeof v === 'boolean') prefs[k.slice(0, 40)] = v
    row.prefs = prefs
  }

  const { error } = await getLegacyServiceSupabase().from('app_push_devices').upsert(row, { onConflict: 'token' })
  if (error) {
    console.error('[admin/app/devices] upsert failed', error.message)
    return jsonError('Could not register device', 500)
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}

export async function DELETE(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res
  const body = await readJson(req)
  const token = body && typeof body.token === 'string' ? body.token.trim().toLowerCase() : ''
  if (!TOKEN_RE.test(token)) return jsonError('Invalid device token')
  await getLegacyServiceSupabase().from('app_push_devices').delete().eq('token', token).eq('user_id', g.admin.userId)
  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
