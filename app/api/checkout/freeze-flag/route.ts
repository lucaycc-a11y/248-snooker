import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPaymentFreezeActive } from '@/lib/payments/freeze-flag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/checkout/freeze-flag — tells the payment UI whether the confirm-page-first
// handoff and the freeze behaviours apply to the signed-in customer (admins until
// PAYMENT_FREEZE_PUBLIC=true).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ active: false })
  return NextResponse.json({ active: await isPaymentFreezeActive(user.id) })
}
