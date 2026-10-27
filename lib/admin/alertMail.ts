import { getResend } from '@/lib/resend/client'
import { emailButton, emailParagraph, escapeHtml, renderEmailLayout } from '@/lib/resend/layout'
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

// ── HTML: same black card layout as the booking receipt (lib/resend/layout.ts) ──────────
// Every dynamic value must pass through escapeHtml (the helpers below do it for you).

const GREEN = '#22c55e'
const RED = '#ef4444'

/** Wraps already-built body HTML in the shared Space8 email layout. */
export function adminMailShell(title: string, bodyHtml: string, tone: 'normal' | 'critical' = 'normal', preheader = ''): string {
  const badge =
    tone === 'critical'
      ? `<p style="text-align:center;margin:0 0 20px;"><span style="display:inline-block;background:${RED};color:#ffffff;font-size:12px;font-weight:700;letter-spacing:1px;padding:4px 14px;border-radius:999px;">緊急</span></p>`
      : ''
  return renderEmailLayout({
    locale: 'zh-HK',
    title: escapeHtml(title),
    preheader: escapeHtml(preheader || title),
    bodyHtml: `${badge}${bodyHtml}`,
    footerHtml: 'Space8 後台自動發送 · 請勿直接回覆此地址',
  })
}

/** A paragraph of plain text. */
export function mailText(text: string, opts: { muted?: boolean; small?: boolean } = {}): string {
  return emailParagraph(escapeHtml(text), opts)
}

/** Highlighted block (AI diagnosis, summary). `html` must already be escaped. */
export function mailCallout(html: string, tone: 'info' | 'critical' = 'info'): string {
  return `<div style="background:#141414;border-left:3px solid ${tone === 'critical' ? RED : GREEN};border-radius:10px;padding:12px 14px;margin:0 0 16px;color:#e5e5e5;font-size:14px;line-height:1.65;white-space:pre-wrap;">${html}</div>`
}

/** Titled items, each with a muted detail line and optional extra HTML (already escaped). */
export function mailItems(items: { title: string; detail: string; extraHtml?: string }[]): string {
  return items
    .map(
      (i) =>
        `<div style="border-top:1px solid #262626;padding:14px 0;">
  <p style="color:#ffffff;font-size:15px;font-weight:600;line-height:1.5;margin:0 0 4px;">${escapeHtml(i.title)}</p>
  <p style="color:#a3a3a3;font-size:13px;line-height:1.6;margin:0;">${escapeHtml(i.detail)}</p>${i.extraHtml ? `<div style="margin-top:10px;">${i.extraHtml}</div>` : ''}
</div>`,
    )
    .join('')
}

/** Label / value rows. Values are plain text. */
export function mailFacts(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="color:#737373;font-size:13px;padding:5px 12px 5px 0;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td><td style="color:#e5e5e5;font-size:13px;padding:5px 0;word-break:break-all;">${escapeHtml(v)}</td></tr>`,
    )
    .join('')}</table>`
}

/** Green pill button, same as the booking email. */
export function mailButton(href: string, label: string): string {
  return `<div style="margin:24px 0 0;">${emailButton(escapeHtml(href), escapeHtml(label))}</div>`
}

export { escapeHtml }
