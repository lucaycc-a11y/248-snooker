// Server-only: imports the service-role client. Never import from a Client Component.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'
import { validatePassword, type PasswordReason } from '@/lib/auth/password'
import { getResend } from '@/lib/resend/client'
import { SITE_CONTACT } from '@/lib/site/contact'
import type { EmailLayoutLocale } from '@/lib/resend/layout'
import {
  passwordChangedEmail,
  passwordResetLinkEmail,
  signInMethodEmail,
  type RenderedEmail,
  type SignInMethod,
} from '@/lib/resend/templates/password-reset'

// ════════════════════════════════════════════════════════════════════════════
// Password reset by email link (Part B2).
//
// Request → Supabase admin.generateLink({ type: 'recovery' }) mints a token,
// but we email OUR OWN /reset-password?token_hash=… URL (never action_link),
// so opening the email never consumes it. Complete → verifyOtp + password
// update + global sign-out, all server-side, only on form submit.
//
// Never log: token_hash, action_link, password.
// ════════════════════════════════════════════════════════════════════════════

const FROM = 'Space8 <no-reply@space8.com.hk>'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX = 254
const TOKEN_HASH_RE = /^[A-Za-z0-9_-]{16,128}$/

/** Neutral by design: the caller cannot tell whether the account exists. */
export type RequestResetResult =
  | { ok: true }
  | { ok: false; error: 'invalid_email' | 'cooldown' | 'rate_limited' | 'unavailable' }

export type CompleteResetResult =
  | { ok: true }
  | { ok: false; error: 'password_weak'; reasons: PasswordReason[] }
  | { ok: false; error: 'password_mismatch' | 'link_invalid' | 'update_failed' | 'rate_limited' }

type EmailType = 'password_reset_link' | 'password_reset_signin_method' | 'password_changed'

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) return null
  return email
}

export function toEmailLocale(value: unknown): EmailLayoutLocale {
  return value === 'zh-CN' || value === 'en' ? value : 'zh-HK'
}

/**
 * App base URL from env — UAT and production differ, so never hardcode.
 * NEXT_PUBLIC_SITE_URL first, NEXT_PUBLIC_APP_URL second; local dev falls back
 * to localhost. Returns null (fail closed) rather than trusting the Host header.
 */
export function getAppBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (raw) {
    try {
      const url = new URL(raw)
      if (url.protocol === 'https:' || url.hostname === 'localhost') return url.origin
    } catch {
      // fall through
    }
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000'
  return null
}

async function logEmail(params: {
  userId: string | null
  type: EmailType
  status: 'sent' | 'failed'
  error?: string
}): Promise<void> {
  try {
    const { error } = await getServiceSupabase().from('notification_log').insert({
      user_id: params.userId,
      channel: 'email',
      type: params.type,
      status: params.status,
      error_message: params.error ? params.error.slice(0, 500) : null,
    })
    if (error) console.error('[password-reset] notification_log insert failed', { type: params.type, error: error.message })
  } catch (err) {
    console.error('[password-reset] notification_log insert threw', { type: params.type, error: err instanceof Error ? err.message : 'unknown' })
  }
}

/**
 * Security email: ignores notification toggles. A Resend error is returned as
 * false and logged to notification_log — never reported as success.
 */
async function sendSecurityEmail(to: string, email: RenderedEmail, type: EmailType, userId: string | null): Promise<boolean> {
  try {
    const { data, error } = await getResend().emails.send({
      from: FROM,
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: { 'X-Entity-Ref-ID': `${type}-${Date.now()}` },
    })
    if (error || !data?.id) {
      const message = error?.message ?? 'resend returned no id'
      console.error('[password-reset] resend send failed', { type, error: message })
      await logEmail({ userId, type, status: 'failed', error: message })
      return false
    }
    console.info('[password-reset] email sent', { type, resendId: data.id })
    await logEmail({ userId, type, status: 'sent' })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[password-reset] resend send threw', { type, error: message })
    await logEmail({ userId, type, status: 'failed', error: message })
    return false
  }
}

function isDeletedFlag(row: unknown): boolean {
  return typeof row === 'object' && row !== null && 'is_deleted' in row && row.is_deleted === true
}

/**
 * Soft-deleted (Part C) accounts are treated as non-existent. This matters
 * beyond hygiene: any new session restores a soft-deleted account
 * (restore_on_new_session trigger), so a reset link must never be issued.
 */
async function isAccountDeleted(userId: string, email: string): Promise<boolean> {
  const service = getServiceSupabase()
  const [{ data: request }, { data: reserved }, { data: profile, error: profileError }] = await Promise.all([
    service
      .from('data_deletion_requests')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['pending', 'completed'])
      .limit(1)
      .maybeSingle<{ id: string }>(),
    service.rpc('is_identity_reserved', { p_kind: 'email', p_value: email }),
    // users.is_deleted (Part C) is not in the generated types yet.
    service.from('users').select('is_deleted').eq('id', userId).maybeSingle<unknown>(),
  ])
  if (profileError) console.error('[password-reset] is_deleted lookup failed', { userId, error: profileError.message })
  return Boolean(request) || reserved === true || isDeletedFlag(profile)
}

async function hasPassword(userId: string): Promise<boolean> {
  const { data } = await getServiceSupabase()
    .from('user_password_status')
    .select('password_set')
    .eq('user_id', userId)
    .maybeSingle<{ password_set: boolean }>()
  return data?.password_set === true
}

function signInMethods(identities: ReadonlyArray<{ provider: string }> | undefined, phone: string | undefined): SignInMethod[] {
  const providers = new Set((identities ?? []).map((i) => i.provider))
  const methods: SignInMethod[] = []
  if (providers.has('google')) methods.push('google')
  if (providers.has('apple')) methods.push('apple')
  if (providers.has('phone') || phone) methods.push('sms')
  return methods.length > 0 ? methods : ['sms']
}

/**
 * Rolling 60 s cooldown per account. check_rate_limit windows are aligned to the
 * clock, so they can reset seconds after a send; this reads the last SUCCESSFUL
 * send instead (a failed send never blocks a retry). Checked before
 * generateLink so a repeat never rotates the token in the email already sent.
 */
async function sentWithinCooldown(email: string): Promise<boolean> {
  const service = getServiceSupabase()
  const { data: profile } = await service.from('users').select('id').eq('email', email).limit(1).maybeSingle<{ id: string }>()
  if (!profile) return false
  const since = new Date(Date.now() - 60_000).toISOString()
  const { data: recent } = await service
    .from('notification_log')
    .select('id')
    .eq('user_id', profile.id)
    .in('type', ['password_reset_link', 'password_reset_signin_method'])
    .eq('status', 'sent')
    .gte('sent_at', since)
    .limit(1)
    .maybeSingle<{ id: string }>()
  return Boolean(recent)
}

function isUserNotFound(error: { status?: number; code?: string; message?: string }): boolean {
  return error.status === 404 || error.code === 'user_not_found' || /not found/i.test(error.message ?? '')
}

/**
 * Step 1. Always neutral for existing vs unknown email. Rate limits (via
 * check_rate_limit): 60 s cooldown per email, 3/hour per email, 3/hour per IP.
 */
export async function requestPasswordReset(params: {
  email: unknown
  ip: string
  locale: EmailLayoutLocale
}): Promise<RequestResetResult> {
  const email = normalizeEmail(params.email)
  if (!email) return { ok: false, error: 'invalid_email' }

  const baseUrl = getAppBaseUrl()
  if (!baseUrl) {
    console.error('[password-reset] NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL not set — refusing to build reset link')
    return { ok: false, error: 'unavailable' }
  }

  if (!(await rateLimit('pw_reset_ip_hour', `ip:${params.ip}`, 3, 3600))) return { ok: false, error: 'rate_limited' }
  if (!(await rateLimit('pw_reset_email_cooldown', `email:${email}`, 1, 60))) return { ok: false, error: 'cooldown' }
  if (!(await rateLimit('pw_reset_email_hour', `email:${email}`, 3, 3600))) return { ok: false, error: 'rate_limited' }

  // Neutral success: the caller can't tell a skipped send from a real one.
  if (await sentWithinCooldown(email)) return { ok: true }

  const service = getServiceSupabase()
  const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email })
  if (error) {
    if (isUserNotFound(error)) return { ok: true }
    console.error('[password-reset] generateLink failed', { status: error.status, code: error.code })
    return { ok: false, error: 'unavailable' }
  }

  const user = data.user
  if (await isAccountDeleted(user.id, email)) return { ok: true }

  if (!(await hasPassword(user.id))) {
    const notice = signInMethodEmail(params.locale, signInMethods(user.identities, user.phone), `${baseUrl}/login`)
    return (await sendSecurityEmail(email, notice, 'password_reset_signin_method', user.id))
      ? { ok: true }
      : { ok: false, error: 'unavailable' }
  }

  const resetUrl = `${baseUrl}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`
  const message = passwordResetLinkEmail(params.locale, resetUrl)
  return (await sendSecurityEmail(email, message, 'password_reset_link', user.id))
    ? { ok: true }
    : { ok: false, error: 'unavailable' }
}

/**
 * Step 2, only on form submit. Password is validated BEFORE the token is
 * touched so a weak password never burns the link. verifyOtp runs on an
 * isolated, non-persisting client — no session cookie is ever set here.
 */
export async function completePasswordReset(params: {
  tokenHash: unknown
  password: unknown
  confirm: unknown
  ip: string
  locale: EmailLayoutLocale
}): Promise<CompleteResetResult> {
  if (!(await rateLimit('pw_reset_complete_ip', `ip:${params.ip}`, 10, 600))) return { ok: false, error: 'rate_limited' }

  const { tokenHash, password, confirm } = params
  if (typeof tokenHash !== 'string' || !TOKEN_HASH_RE.test(tokenHash)) return { ok: false, error: 'link_invalid' }
  if (typeof password !== 'string' || password !== confirm) return { ok: false, error: 'password_mismatch' }
  const check = validatePassword(password)
  if (!check.ok) return { ok: false, error: 'password_weak', reasons: check.reasons }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return { ok: false, error: 'update_failed' }

  const isolated = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: verified, error: verifyError } = await isolated.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
  if (verifyError || !verified.user || !verified.session) {
    // Expired and already-used both land here; Supabase reports them identically.
    return { ok: false, error: 'link_invalid' }
  }

  const user = verified.user
  const service = getServiceSupabase()

  // Revoke every session (all devices) explicitly, while the recovery session
  // still exists to authorise it. (GoTrue's admin password update also drops
  // sessions — verified live — but we don't rely on that side effect.)
  const { error: signOutError } = await service.auth.admin.signOut(verified.session.access_token, 'global')
  if (signOutError) {
    console.error('[password-reset] global sign-out failed', { userId: user.id, status: signOutError.status, code: signOutError.code })
  }

  const { error: updateError } = await service.auth.admin.updateUserById(user.id, { password })
  if (updateError) {
    console.error('[password-reset] password update failed', { userId: user.id, status: updateError.status, code: updateError.code })
    if (updateError.code === 'weak_password') return { ok: false, error: 'password_weak', reasons: [] }
    return { ok: false, error: 'update_failed' }
  }

  const changedAt = new Date()
  const [statusResult, auditResult] = await Promise.all([
    service.from('user_password_status').upsert(
      { user_id: user.id, password_set: true, password_set_at: changedAt.toISOString(), updated_at: changedAt.toISOString() },
      { onConflict: 'user_id' },
    ),
    service.from('account_change_audit').insert({
      user_id: user.id,
      action: 'complete_password_change',
      request_ip: params.ip,
    }),
  ])
  if (statusResult.error) console.error('[password-reset] password status upsert failed', { userId: user.id, error: statusResult.error.message })
  if (auditResult.error) console.error('[password-reset] audit insert failed', { userId: user.id, error: auditResult.error.message })

  if (user.email) {
    // The password change already succeeded; a failed notice is logged, not surfaced.
    await sendSecurityEmail(user.email, passwordChangedEmail(params.locale, changedAt, SITE_CONTACT.whatsappUrl), 'password_changed', user.id)
  }

  return { ok: true }
}
