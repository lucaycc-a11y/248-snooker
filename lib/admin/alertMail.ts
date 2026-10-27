import { getResend } from '@/lib/resend/client'
import { escapeHtml } from '@/lib/resend/layout'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// One place that sends mail to the site owner / admins (bug reports + automatic alerts).
// Sender is the already-verified Space8 domain used by every other email.
//
// Audience:
//   'owner'      — lucaycc@gmail.com only (bug reports, ordinary alerts, tests).
//   'all-admins' — the owner plus every active admin. Reserved for money-critical
//                  problems, e.g. KPay says paid but the booking was not made.

export const ADMIN_ALERT_FROM = 'Space8 後台 <no-reply@space8.com.hk>'

export type MailAudience = 'owner' | 'all-admins'

export function ownerEmail(): string {
  return process.env.ADMIN_ALERT_EMAIL?.trim() || 'lucaycc@gmail.com'
}

export async function resolveRecipients(audience: MailAudience): Promise<string[]> {
  const owner = ownerEmail()
  if (audience === 'owner') return [owner]
  const service = getLegacyServiceSupabase()
  const { data, error } = await service.from('admin_users').select('email').eq('invite_status', 'active')
  if (error) {
    // Never drop a critical alert because the admin list failed to load.
    console.error('[admin/alert-mail] admin list failed, falling back to owner', error.message)
    return [owner]
  }
  const emails = new Set<string>([owner.toLowerCase()])
  for (const row of (data ?? []) as { email?: unknown }[]) {
    if (typeof row.email === 'string' && row.email.includes('@')) emails.add(row.email.trim().toLowerCase())
  }
  return [...emails]
}

export type AdminMailAttachment = { filename: string; content: Buffer }

export async function sendAdminMail(input: {
  subject: string
  html: string
  audience?: MailAudience
  replyTo?: string
  attachments?: AdminMailAttachment[]
}): Promise<{ recipients: string[] }> {
  const resend = getResend()
  const recipients = await resolveRecipients(input.audience ?? 'owner')
  const { error } = await resend.emails.send({
    from: ADMIN_ALERT_FROM,
    to: recipients,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.attachments && input.attachments.length > 0 ? { attachments: input.attachments } : {}),
  })
  if (error) throw new Error(`電郵發送失敗：${error.message}`)
  return { recipients }
}

/** Plain, readable shell for owner-facing mail. Every dynamic value must go through `escapeHtml`. */
export function adminMailShell(title: string, bodyHtml: string, tone: 'normal' | 'critical' = 'normal'): string {
  const bar = tone === 'critical' ? '#c0392b' : '#1f7a4d'
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'PingFang HK','Noto Sans TC',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#14201a">
  <div style="height:4px;background:${bar};border-radius:2px;margin-bottom:18px"></div>
  <h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(title)}</h2>
  ${bodyHtml}
  <p style="margin-top:28px;font-size:12px;color:#6b7a72">Space8 後台自動發送 · <a href="https://space8.com.hk/admin" style="color:#1f7a4d">開啟後台</a></p>
</div>`
}

export { escapeHtml }
