import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { generateGatePassword } from '@/lib/gate/password'

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

type Body = { action: 'toggle'; enabled: boolean } | { action: 'regenerate_password' }

function isBody(value: unknown): value is Body {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (v.action === 'toggle') return typeof v.enabled === 'boolean'
  return v.action === 'regenerate_password'
}

// POST /api/admin/site-gate — toggle the gate on/off, or regenerate the
// password (returned ONCE in the response; only the hash is persisted).
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
      .select('enabled')
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

    // regenerate_password
    const { password, salt, hash } = await generateGatePassword()
    const { error } = await service
      .from('site_gate_config')
      .update({
        password_hash: hash,
        password_salt: salt,
        updated_at: new Date().toISOString(),
        updated_by: admin.userId,
      })
      .eq('id', CONFIG_ID)
    if (error) {
      console.error('[admin/site-gate] regenerate failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'site_gate_regenerate_password',
      target_table: 'site_gate_config',
      target_id: CONFIG_ID,
      before_value: null,
      after_value: null, // never store the plaintext password, even in the audit log
    })

    return NextResponse.json({ success: true, password })
  } catch (err) {
    console.error('[admin/site-gate] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
