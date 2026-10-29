import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePaymentSystem } from '@/lib/payments/system'
import { PAYMENTX_VERSION } from '@/lib/paymentx/version'

// The payment system the checkout should render for the current visitor (override > public).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const system = await getEffectivePaymentSystem(user?.id ?? null)
    return NextResponse.json({ system, paymentxVersion: PAYMENTX_VERSION }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ system: null }, { status: 200 })
  }
}
