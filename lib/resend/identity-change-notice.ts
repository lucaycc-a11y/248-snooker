import { getResend } from './client'
import { SITE_CONTACT } from '@/lib/site/contact'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

// Security notice after an admin changes a member's phone or email
// (admin_change_user_identity). Sent regardless of notification toggles.
// Uses the same universal dark layout as the other transactional emails
// (logo, #0a0a0a card, green accent — see app/api/auth/password-changed).
//
// /member has no stored language preference (users has no locale column and
// /member is pinned to zh-HK), so one email carries 繁 / 简 / EN in that order.

export type IdentityKind = 'phone' | 'email'

type NoticeInput = {
  userId: string
  kind: IdentityKind
  oldMasked: string | null
  newMasked: string
  changedAt: string
  recipients: string[]
}

export type NoticeResult = { to: string; id: string | null; error: string | null }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    dateStyle: 'medium',
    timeStyle: 'short',
    hour12: false,
  })
}

const COPY = {
  'zh-HK': {
    phone: '電話號碼', email: '電郵地址',
    title: (w: string) => `您的${w}已更改`,
    body: (w: string) => `客服已按您的要求更改您 Space8 帳戶的${w}。`,
    from: '原有', to: '更改為', time: '時間',
    warn: '如非本人操作，請立即聯絡客服：',
    link: 'WhatsApp 聯絡客服',
    signout: '為保障帳戶安全，所有裝置已登出，請重新登入。',
  },
  'zh-CN': {
    phone: '电话号码', email: '电邮地址',
    title: (w: string) => `您的${w}已更改`,
    body: (w: string) => `客服已按您的要求更改您 Space8 账户的${w}。`,
    from: '原有', to: '更改为', time: '时间',
    warn: '如非本人操作，请立即联系客服：',
    link: 'WhatsApp 联系客服',
    signout: '为保障账户安全，所有设备已登出，请重新登录。',
  },
  en: {
    phone: 'phone number', email: 'email address',
    title: (w: string) => `Your ${w} was changed`,
    body: (w: string) => `Customer service changed the ${w} on your Space8 account at your request.`,
    from: 'Previous', to: 'New', time: 'Time',
    warn: 'If this was not you, contact customer service immediately:',
    link: 'WhatsApp customer service',
    signout: 'For your security, all devices have been signed out. Please sign in again.',
  },
} as const

function section(locale: keyof typeof COPY, input: NoticeInput, time: string): string {
  const c = COPY[locale]
  const what = c[input.kind]
  const colon = locale === 'en' ? ': ' : '：'
  const row = (label: string, value: string) =>
    `<p style="color:#a3a3a3;font-size:13px;margin:0 0 8px;"><strong style="color:#fff;">${label}${colon}</strong>${escapeHtml(value)}</p>`
  return `
    <h2 style="color:#fff;font-size:20px;font-weight:600;margin:0 0 10px;text-align:center;">${c.title(what)}</h2>
    <p style="color:#a3a3a3;font-size:15px;line-height:1.6;margin:0 0 20px;text-align:center;">${c.body(what)}</p>
    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
      ${input.oldMasked ? row(c.from, input.oldMasked) : ''}
      ${row(c.to, input.newMasked)}
      ${row(c.time, time)}
    </div>
    <p style="color:#a3a3a3;font-size:14px;line-height:1.6;text-align:center;margin:0 0 8px;">${c.signout}</p>
    <p style="color:#fff;font-size:14px;line-height:1.6;text-align:center;margin:0 0 32px;">${c.warn}
      <a href="${SITE_CONTACT.whatsappUrl}" style="color:#22c55e;text-decoration:underline;">${c.link}</a></p>`
}

export function renderIdentityChangeEmail(input: NoticeInput): { subject: string; html: string } {
  const time = formatTime(input.changedAt)
  const subject =
    input.kind === 'phone'
      ? 'Space8 帳戶電話號碼已更改 / Phone number changed'
      : 'Space8 帳戶電郵地址已更改 / Email address changed'
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;max-width:600px;margin:0 auto;padding:48px 24px;background:#000;color:#fff;">
  <div style="text-align:center;padding-bottom:32px;">
    <img src="https://space8.com.hk/logos/space8-logo-email.png" alt="Space8" width="280" style="max-width:100%;height:auto;" />
  </div>
  <div style="background:#0a0a0a;border-radius:24px;padding:40px;border:1px solid rgba(34,197,94,0.2);">
    ${section('zh-HK', input, time)}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 32px;" />
    ${section('zh-CN', input, time)}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 32px;" />
    ${section('en', input, time)}
  </div>
  <p style="color:#525252;font-size:12px;text-align:center;margin:32px 0 0;">Space8 · Hong Kong</p>
</div>`
  return { subject, html }
}

/**
 * Send the notice to every recipient and record each attempt in
 * notification_log. Never throws; returns per-recipient Resend ids / errors so
 * the caller can report them instead of claiming success.
 */
export async function sendIdentityChangeNotice(
  service: SupabaseClient<Database>,
  input: NoticeInput,
): Promise<NoticeResult[]> {
  const { subject, html } = renderIdentityChangeEmail(input)
  const results: NoticeResult[] = []

  for (const to of Array.from(new Set(input.recipients.filter(Boolean)))) {
    let result: NoticeResult
    try {
      const { data, error } = await getResend().emails.send({
        from: 'Space8 <no-reply@space8.com.hk>',
        to,
        subject,
        html,
      })
      result = { to, id: data?.id ?? null, error: error ? error.message : null }
      if (!error && !data?.id) result.error = 'resend_returned_no_id'
    } catch (e) {
      result = { to, id: null, error: e instanceof Error ? e.message : String(e) }
    }
    results.push(result)

    const { error: logError } = await service.from('notification_log').insert({
      user_id: input.userId,
      channel: 'email',
      type: `identity_changed_${input.kind}`,
      status: result.error ? 'failed' : 'sent',
      error_message: result.error ? result.error.slice(0, 500) : null,
    })
    if (logError) {
      console.error('[identity-change-notice] notification_log insert failed', { error: logError.message })
    }
  }

  return results
}
