import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { sendAdminInviteEmail } from '@/lib/resend/send'

// Only super_admin may invite. Creates/refreshes a pending admin_users row via
// the invite_admin() RPC (supabase/migrations/0016_admin_invite_rpc.sql), then
// emails the invite link. Every outcome — including a partial failure where the
// row was created but the email didn't send — is logged to audit_log.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://248.formhk.com'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body.role === 'super_admin' ? 'super_admin' : body.role === 'admin' ? 'admin' : null

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (!role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const service = getServiceSupabase()

    const { data: rpcResult, error: rpcError } = await service.rpc('invite_admin', {
      p_email: email,
      p_role: role,
      p_invited_by: admin.userId,
    })
    if (rpcError) {
      console.error('[admin/invite] invite_admin rpc failed', rpcError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // invite_admin() itself verifies the token was actually persisted before
    // reporting success (see 0016's comment) — 'already_active' means the
    // target was already an active admin and no invite was created.
    const rpcPayload = rpcResult as { success?: boolean; token?: string; reason?: string } | null
    if (!rpcPayload?.success || !rpcPayload.token) {
      const status = rpcPayload?.reason === 'already_active' ? 409 : 400
      return NextResponse.json({ error: rpcPayload?.reason ?? 'invite_failed' }, { status })
    }
    const token = rpcPayload.token

    const inviteUrl = `${SITE_URL}/admin/accept-invite?token=${encodeURIComponent(token)}`

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'admin_invite',
      target_table: 'admin_users',
      target_id: email,
      after_value: { email, role },
    })

    try {
      await sendAdminInviteEmail({ to: email, inviteUrl, role })
    } catch (emailError) {
      console.error('[admin/invite] email send failed', emailError)
      return NextResponse.json({ success: true, emailSent: false, inviteUrl })
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (err) {
    console.error('[admin/invite] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
