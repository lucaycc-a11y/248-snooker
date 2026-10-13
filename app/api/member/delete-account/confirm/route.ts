import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getResend } from '@/lib/resend/client'
import { accountDeactivatedEmail } from '@/lib/resend/templates/account-deletion'

// POST /api/member/delete-account/confirm  { code: "123456" }
// Step 2: verifies the code and deactivates the account in one DB transaction
// (account_delete_confirm). Personal data is purged 180 days later by pg_cron.

type ConfirmResult = {
  ok: boolean
  code?: string
  remaining?: number
  email?: string | null
  scheduled_purge_at?: string
}

function isConfirmResult(v: unknown): v is ConfirmResult {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

const STATUS: Record<string, number> = {
  admin_account: 403,
  active_bookings: 409,
  already_deleted: 409,
  code_wrong: 400,
  code_invalid: 400,
  code_expired: 410,
  too_many_attempts: 429,
}

export async function POST(req: Request) {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, code: 'not_authenticated' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  const raw = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, code: 'code_wrong' }, { status: 400 })

  const service = getServiceSupabase()
  const { data, error } = await (service.rpc as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    'account_delete_confirm', { p_user: user.id, p_code: code },
  )

  if (error || !isConfirmResult(data)) {
    console.error('[delete-account/confirm] rpc failed', { userId: user.id, error: error?.message })
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500 })
  }
  if (!data.ok) {
    const c = data.code ?? 'server_error'
    return NextResponse.json({ ok: false, code: c, remaining: data.remaining }, { status: STATUS[c] ?? 400 })
  }

  // Sessions are already revoked in the DB; clear this browser's cookies too.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)

  if (data.email && data.scheduled_purge_at) {
    const mail = accountDeactivatedEmail(data.scheduled_purge_at)
    const { error: sendError } = await getResend().emails.send({
      from: 'Space8 <no-reply@space8.com.hk>',
      to: data.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    if (sendError) {
      // Deactivation already committed; log but do not report failure to the user.
      console.error('[delete-account/confirm] confirmation email failed', { userId: user.id, message: sendError.message })
    }
  }

  return NextResponse.json({ ok: true, scheduledPurgeAt: data.scheduled_purge_at })
}
