import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// The KPay "freeze" behaviour (ask KPay before releasing, confirm late payments, wait for
// KPay's final answer on the confirm page, show payment references) is now ON for everyone.
// Kill switch: set PAYMENT_FREEZE_PUBLIC=false in Vercel to limit it to active admins again.
export function isPaymentFreezePublic(): boolean {
  return process.env.PAYMENT_FREEZE_PUBLIC !== 'false'
}

export async function isPaymentFreezeActive(userId: string | null | undefined): Promise<boolean> {
  if (isPaymentFreezePublic()) return true
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
