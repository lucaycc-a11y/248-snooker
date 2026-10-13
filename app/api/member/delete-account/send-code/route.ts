import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getResend } from '@/lib/resend/client'
import { accountDeleteCodeEmail } from '@/lib/resend/templates/account-deletion'

// POST /api/member/delete-account/send-code
// Step 1 of account deletion. The request body is ignored entirely: the
// recipient comes from public.users for the signed-in user (via the RPC).

type IssueResult = { ok: boolean; code?: string; email?: string; retry_after?: number }

function isIssueResult(v: unknown): v is IssueResult {
  return typeof v === 'object' && v !== null && typeof (v as { ok?: unknown }).ok === 'boolean'
}

const STATUS: Record<string, number> = {
  admin_account: 403,
  active_bookings: 409,
  already_deleted: 409,
  no_email: 422,
  cooldown: 429,
  rate_limited: 429,
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

export async function POST() {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, code: 'not_authenticated' }, { status: 401 })

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  const service = getServiceSupabase()
  // RPC is not in generated types yet; result is validated with a type guard.
  const { data, error } = await (service.rpc as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    'account_delete_issue_code', { p_user: user.id, p_code: code },
  )

  if (error || !isIssueResult(data)) {
    console.error('[delete-account/send-code] rpc failed', { userId: user.id, error: error?.message })
    return NextResponse.json({ ok: false, code: 'server_error' }, { status: 500 })
  }
  if (!data.ok || !data.email) {
    const c = data.code ?? 'server_error'
    return NextResponse.json({ ok: false, code: c, retryAfter: data.retry_after }, { status: STATUS[c] ?? 400 })
  }

  const mail = accountDeleteCodeEmail(code)
  const { error: sendError } = await getResend().emails.send({
    from: 'Space8 <no-reply@space8.com.hk>',
    to: data.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  })
  if (sendError) {
    // Previously swallowed failures would leave the user waiting for a code that
    // never comes. Surface it so the dialog can say so.
    console.error('[delete-account/send-code] resend failed', { userId: user.id, name: sendError.name, message: sendError.message })
    return NextResponse.json({ ok: false, code: 'email_failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, maskedEmail: maskEmail(data.email), expiresIn: 600 })
}
