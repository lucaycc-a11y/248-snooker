import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizeHkPhone } from '@/lib/auth/profile'
import { createVerificationCode, sendEmailVerificationCode } from '@/lib/auth/verification'
import { issueNewContactProof } from '@/lib/auth/contact-change'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Body = { kind?: unknown; value?: unknown; method?: unknown; password?: unknown }
type ChangeKind = 'email' | 'phone'
type CurrentMethod = 'password' | 'otp'
type UserProfile = { email: string | null; phone: string | null }

function parseKind(value: unknown): ChangeKind | null {
  return value === 'email' || value === 'phone' ? value : null
}

function parseMethod(value: unknown): CurrentMethod | null {
  return value === 'password' || value === 'otp' ? value : null
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as Body | null
    const kind = parseKind(body?.kind)
    const method = parseMethod(body?.method)
    const rawValue = typeof body?.value === 'string' ? body.value.trim() : ''
    const newValue = kind === 'phone' ? normalizeHkPhone(rawValue) : rawValue.toLowerCase()
    if (!kind || !method || !newValue || (kind === 'email' && !EMAIL_RE.test(newValue))) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 422 })
    }

    const service = getServiceSupabase()
    const { data: profile, error: profileError } = await service
      .from('users').select('email, phone').eq('id', user.id).maybeSingle<UserProfile>()
    if (profileError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    const currentValue = kind === 'phone' ? (profile?.phone ?? user.phone ?? '') : (profile?.email ?? user.email ?? '')
    if (!currentValue || newValue.toLowerCase() === currentValue.toLowerCase()) return NextResponse.json({ error: 'same_value' }, { status: 422 })

    const okIp = await rateLimit('auth_contact_change_ip', `ip:${clientIp(request)}`, 10, 15 * 60)
    if (!okIp) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const ownerQuery = kind === 'phone'
      ? service.from('users').select('id').eq('phone', newValue).maybeSingle<{ id: string }>()
      : service.from('users').select('id').eq('email', newValue).maybeSingle<{ id: string }>()
    const { data: owner, error: ownerError } = await ownerQuery
    if (ownerError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (owner && owner.id !== user.id) return NextResponse.json({ error: kind === 'phone' ? 'phone_exists' : 'email_exists' }, { status: 409 })

    const { data: requestRow, error: requestError } = await service.from('contact_change_requests').insert({
      user_id: user.id,
      kind,
      current_value: currentValue,
      new_value: newValue,
      current_method: method,
    }).select('id').single<{ id: string }>()
    if (requestError || !requestRow) {
      if (requestError?.code === '23505') return NextResponse.json({ error: 'change_in_progress' }, { status: 409 })
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    try {
      if (method === 'password') {
        const password = typeof body?.password === 'string' ? body.password : ''
        if (!password) {
          await service.from('contact_change_requests').update({ status: 'expired' }).eq('id', requestRow.id)
          return NextResponse.json({ error: 'password_required' }, { status: 422 })
        }
        const credentials = kind === 'phone'
          ? { phone: currentValue, password }
          : { email: currentValue, password }
        const { error: reauthError } = await supabase.auth.signInWithPassword(credentials)
        if (reauthError) {
          await service.from('contact_change_requests').update({ status: 'expired' }).eq('id', requestRow.id)
          return NextResponse.json({ error: 'password_invalid' }, { status: 400 })
        }
        await issueNewContactProof(service, requestRow.id, kind, newValue)
        return NextResponse.json({ ok: true, requestId: requestRow.id, status: 'awaiting_new' })
      }

      if (kind === 'phone') {
        const sms = await sendEngagelabOtp(currentValue, 'zh_HK')
        await service.from('contact_change_requests').update({ current_message_id: sms.message_id }).eq('id', requestRow.id)
        return NextResponse.json({ ok: true, requestId: requestRow.id, currentChannel: sms.send_channel })
      }
      const currentCode = createVerificationCode()
      await service.from('contact_change_requests').update({ current_code_hash: currentCode.hash, current_code_expires_at: currentCode.expiresAt }).eq('id', requestRow.id)
      await sendEmailVerificationCode({ to: currentValue, code: currentCode.code, purpose: 'contact-change' })
      return NextResponse.json({ ok: true, requestId: requestRow.id, status: 'awaiting_current' })
    } catch (error) {
      await service.from('contact_change_requests').update({ status: 'expired' }).eq('id', requestRow.id)
      console.error('[profile/contact-change/start] delivery failed', error)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
  } catch (error) {
    console.error('[profile/contact-change/start] error', error)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export { issueNewContactProof }
