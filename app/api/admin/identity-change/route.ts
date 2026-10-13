import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizePhone } from '@/lib/phone'
import { sendIdentityChangeNotice, type IdentityKind } from '@/lib/resend/identity-change-notice'

// POST /api/admin/identity-change
// The only supported way to change a member's phone or email (Part B1).
// Admin session required; the DB work happens in admin_change_user_identity()
// (service_role only), which validates, enforces the 90-day cooldown, updates
// auth.users + public.users in one transaction, records hashes, revokes
// sessions and writes audit_log. This route then sends the security notice.
// Runbook: docs/admin-identity-change.md
//
// Body: { user_id, new_phone? | new_email?, reason, override? }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

type RpcResult =
  | { success: false; code: string; message: string }
  | {
      success: true
      kind: IdentityKind
      old_masked: string | null
      new_masked: string
      old_email: string | null
      new_email: string | null
      sessions_revoked: number
      changed_at: string
    }

function isRpcResult(value: unknown): value is RpcResult {
  if (!isRecord(value) || typeof value.success !== 'boolean') return false
  if (value.success === false) return typeof value.code === 'string'
  return (value.kind === 'phone' || value.kind === 'email') && typeof value.new_masked === 'string'
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isRecord(body)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const userId = optString(body.user_id)
  const reason = optString(body.reason)
  const rawPhone = optString(body.new_phone)
  const rawEmail = optString(body.new_email)
  const override = body.override === true

  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'user_id must be a uuid' }, { status: 400 })
  }
  if (!reason) return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  if ((rawPhone === null) === (rawEmail === null)) {
    return NextResponse.json({ error: 'Provide exactly one of new_phone or new_email' }, { status: 400 })
  }

  let newPhone: string | null = null
  if (rawPhone) {
    newPhone = normalizePhone(rawPhone)
    if (!newPhone) return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const service = getServiceSupabase()
  const { data, error } = await service.rpc('admin_change_user_identity', {
    p_user_id: userId,
    p_new_phone: newPhone,
    p_new_email: rawEmail ? rawEmail.toLowerCase() : null,
    p_reason: reason,
    p_admin_user_id: admin.userId,
    p_override: override,
  })

  if (error) {
    console.error('[admin/identity-change] rpc failed', { code: error.code, message: error.message })
    return NextResponse.json({ error: 'Identity change failed' }, { status: 500 })
  }
  if (!isRpcResult(data)) {
    console.error('[admin/identity-change] unexpected rpc result')
    return NextResponse.json({ error: 'Identity change failed' }, { status: 500 })
  }
  if (!data.success) {
    const status = data.code === 'in_use' || data.code === 'previously_used' || data.code === 'cooldown' ? 409 : 400
    return NextResponse.json({ error: data.message, code: data.code }, { status })
  }

  // Old address always; new address too when the email itself changed.
  const recipients = [data.old_email, data.new_email].filter((v): v is string => typeof v === 'string')
  const emails = recipients.length
    ? await sendIdentityChangeNotice(service, {
        userId,
        kind: data.kind,
        oldMasked: data.old_masked,
        newMasked: data.new_masked,
        changedAt: data.changed_at,
        recipients,
      })
    : []

  return NextResponse.json({
    success: true,
    kind: data.kind,
    old: data.old_masked,
    new: data.new_masked,
    sessions_revoked: data.sessions_revoked,
    emails,
    email_ok: emails.length > 0 && emails.every((e) => e.error === null),
  })
}
