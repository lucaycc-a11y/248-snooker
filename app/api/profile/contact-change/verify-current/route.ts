import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { isVerificationCodeValid } from '@/lib/auth/verification'
import { verifyEngagelabOtp } from '@/lib/engagelab/otp'
import { issueNewContactProof } from '@/lib/auth/contact-change'

type Body = { requestId?: unknown; code?: unknown }
type RequestRow = {
  id: string
  user_id: string
  kind: 'email' | 'phone'
  current_message_id: string | null
  current_code_hash: string | null
  current_code_expires_at: string | null
  status: string
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

    const body = (await request.json().catch(() => null)) as Body | null
    const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!requestId || !code) return NextResponse.json({ error: 'invalid_input' }, { status: 422 })

    const service = getServiceSupabase()
    const { data: change, error } = await service
      .from('contact_change_requests')
      .select('id, user_id, kind, current_message_id, current_code_hash, current_code_expires_at, status')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'awaiting_current')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle<RequestRow>()
    if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!change) return NextResponse.json({ error: 'change_expired' }, { status: 410 })

    const valid = change.kind === 'phone'
      ? Boolean(change.current_message_id && (await verifyEngagelabOtp(change.current_message_id, code)).verified === true)
      : isVerificationCodeValid(code, change.current_code_hash, change.current_code_expires_at)
    if (!valid) return NextResponse.json({ error: 'invalid_code' }, { status: 400 })

    const verifiedAt = new Date().toISOString()
    const { data: advanced, error: updateError } = await service
      .from('contact_change_requests')
      .update({ current_verified_at: verifiedAt, status: 'awaiting_new' })
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('status', 'awaiting_current')
      .select('id, kind, new_value')
      .maybeSingle<{ id: string; kind: 'email' | 'phone'; new_value: string }>()
    if (updateError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    if (!advanced) return NextResponse.json({ error: 'change_expired' }, { status: 410 })

    try {
      await issueNewContactProof(service, advanced.id, advanced.kind, advanced.new_value)
    } catch (deliveryError) {
      await service.from('contact_change_requests').update({ status: 'expired' }).eq('id', advanced.id)
      console.error('[profile/contact-change/verify-current] new delivery failed', deliveryError)
      return NextResponse.json({ error: 'send_failed' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, requestId: advanced.id, status: 'awaiting_new' })
  } catch (error) {
    console.error('[profile/contact-change/verify-current] error', error)
    return NextResponse.json({ error: 'verification_failed' }, { status: 500 })
  }
}
