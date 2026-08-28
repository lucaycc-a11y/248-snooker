import { getServiceSupabase } from '@/lib/supabase/service'
import { createVerificationCode, sendEmailVerificationCode } from '@/lib/auth/verification'
import { sendEngagelabOtp } from '@/lib/engagelab/otp'

type ChangeKind = 'email' | 'phone'

export async function issueNewContactProof(
  service: ReturnType<typeof getServiceSupabase>,
  requestId: string,
  kind: ChangeKind,
  newValue: string,
): Promise<void> {
  if (kind === 'phone') {
    const sms = await sendEngagelabOtp(newValue, 'zh_HK')
    const { error } = await service.from('contact_change_requests').update({
      new_message_id: sms.message_id,
      status: 'awaiting_new',
    }).eq('id', requestId)
    if (error) throw error
    return
  }

  const code = createVerificationCode()
  const { error } = await service.from('contact_change_requests').update({
    new_code_hash: code.hash,
    new_code_expires_at: code.expiresAt,
    status: 'awaiting_new',
  }).eq('id', requestId)
  if (error) throw error
  await sendEmailVerificationCode({ to: newValue, code: code.code, purpose: 'contact-change' })
}
