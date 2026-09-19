import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { hashGatePassword } from '@/lib/gate/password'

// Minimum password length raised from 6 to 10 to reduce brute-force risk on
// the 5-attempts-per-minute rate limit window.
const MIN_PASSWORD_LENGTH = 10

export const runtime = 'nodejs'

const CONFIG_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/admin/site-gate — current enabled state (never returns the hash).
export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = getServiceSupabase()
  const { data } = await service
    .from('site_gate_config')
    .select('enabled, updated_at')
    .eq('id', CONFIG_ID)
    .maybeSingle()

  return NextResponse.json({ enabled: data?.enabled === true, updatedAt: data?.updated_at ?? null })
}

type Body = { action: 'toggle'; enabled: boolean } | { action: 'set_password'; password: string }

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.action === 'toggle') return typeof v.enabled === 'boolean'
  if (v.action === 'set_password') return typeof v.password === 'string'
  return false
}

// POST /api/admin/site-gate — toggle the gate on/off, or change the password.
// set_password increments password_version in the same DB update as the new
// hash/salt, so all previously issued bypass cookies are immediately invalid.
export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isBody(body)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('site_gate_config')
      .select('enabled, password_version')
      .eq('id', CONFIG_ID)
      .maybeSingle()

    if (body.action === 'toggle') {
      const { error } = await service
        .from('site_gate_config')
        .update({ enabled: body.enabled, updated_at: new Date().toISOString(), updated_by: admin.userId })
        .eq('id', CONFIG_ID)
      if (error) {
        console.error('[admin/site-gate] toggle failed', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
      }

      await service.from('audit_log').insert({
        admin_user_id: admin.userId,
        admin_email: admin.email,
        action: 'site_gate_toggle',
        target_table: 'site_gate_config',
        target_id: CONFIG_ID,
        before_value: { enabled: existing?.enabled ?? false },
        after_value: { enabled: body.enabled },
      })

      return NextResponse.json({ success: true, enabled: body.enabled })
    }

    // set_password — admin-chosen password, hashed before it ever touches the DB.
    if (body.password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
    }

    const { salt, hash } = await hashGatePassword(body.password)
    const currentVersion = (existing?.password_version as number | null) ?? 1
    const nextVersion = currentVersion + 1

    const { error } = await service
      .from('site_gate_config')
      .update({
        password_hash: hash,
        password_salt: salt,
        // Increment version atomically with the new hash — any cookie carrying
        // the old version is rejected immediately by middleware.
        password_version: nextVersion,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      })
      .eq('id', CONFIG_ID)
    if (error) {
      console.error('[admin/site-gate] set_password failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // Audit log records only version numbers — never the password, hash, or salt.
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'site_gate_set_password',
      target_table: 'site_gate_config',
      target_id: CONFIG_ID,
      before_value: { password_version: currentVersion },
      after_value: { password_version: nextVersion },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/site-gate] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
