import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaymentXTester } from '@/lib/paymentx/testers'
import { PAYMENTX_VERSION } from '@/lib/paymentx/version'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/paymentx/eligible — is the signed-in account on the PaymentX test list?
// Fails closed: signed-out or any error means not eligible.
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ eligible: false })
    const eligible = await isPaymentXTester(user.id)
    return NextResponse.json({ eligible, version: PAYMENTX_VERSION })
  } catch {
    return NextResponse.json({ eligible: false })
  }
}
