import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// Rollout switch for the KPay "freeze" behaviour (ask KPay before releasing, park late
// payments for review, wait for KPay's final answer on the confirm page, show payment
// references). While PAYMENT_FREEZE_PUBLIC is not 'true' the new behaviour is effective
// ONLY for active admins; every other customer keeps the previous behaviour. Flip the env
// var to 'true' in Vercel to roll it out to everyone — no deploy of new code is needed.
export async function isPaymentFreezeActive(userId: string | null | undefined): Promise<boolean> {
  if (process.env.PAYMENT_FREEZE_PUBLIC === 'true') return true
  if (!userId) return false
  try {
    const { data, error } = await getLegacyServiceSupabase()
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('invite_status', 'active')
      .maybeSingle()
    if (error) return false
    return !!data
  } catch {
    return false
  }
}
