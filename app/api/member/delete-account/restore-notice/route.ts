import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getResend } from '@/lib/resend/client'
import { accountRestoredEmail } from '@/lib/resend/templates/account-deletion'

// POST /api/member/delete-account/restore-notice
// The auth.sessions trigger restores a soft-deleted account on sign-in and
// sets restore_notice_pending. This one-shot call clears the flag, sends the
// 帳戶已恢復 email, and tells the UI to show the welcome-back notice.

type NoticeResult = { restored: boolean; email?: string | null }

function isNoticeResult(v: unknown): v is NoticeResult {
  return typeof v === 'object' && v !== null && typeof (v as { restored?: unknown }).restored === 'boolean'
}

export async function POST() {
  const supabase = await createRouteHandlerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ restored: false }, { status: 401 })

  const { data, error } = await (getServiceSupabase().rpc as unknown as (
    fn: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)(
    'account_take_restore_notice', { p_user: user.id },
  )
  if (error || !isNoticeResult(data)) {
    console.error('[delete-account/restore-notice] rpc failed', { userId: user.id, error: error?.message })
    return NextResponse.json({ restored: false }, { status: 500 })
  }

  if (data.restored && data.email) {
    const mail = accountRestoredEmail()
    const { error: sendError } = await getResend().emails.send({
      from: 'Space8 <no-reply@space8.com.hk>',
      to: data.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    })
    if (sendError) console.error('[delete-account/restore-notice] email failed', { userId: user.id, message: sendError.message })
  }

  return NextResponse.json({ restored: data.restored })
}
