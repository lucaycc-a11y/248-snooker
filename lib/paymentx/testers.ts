import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// PaymentX is offered only to accounts an admin added in 後台 → 設定 → PaymentX.
// Fails closed: any lookup problem means "not a tester".
export async function isPaymentXTester(userId: string): Promise<boolean> {
  try {
    const { data, error } = await getLegacyServiceSupabase()
      .from('paymentx_testers')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[paymentx] tester lookup failed', error.message)
      return false
    }
    return !!data
  } catch (e) {
    console.warn('[paymentx] tester lookup threw', (e as Error).message)
    return false
  }
}
