import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The signed-in customer's checkout that is still in flight, if any. The booking page calls this
// on a fresh visit: a customer who paid at KPay and then closed the browser or app (so the
// sessionStorage that normally resumes the screen is gone) must land on the payment status screen
// and not on an empty slot picker.
//   pending / payment_review with a KPay order, created in the last 45 min -> still being paid or settled
//   confirmed in the last 15 min                                           -> just paid, show the result
// Read-only. Returns only the booking id and status.

const PENDING_WINDOW_MIN = 45
const CONFIRMED_WINDOW_MIN = 15

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ active: null })

    const allowed = await rateLimit('checkout_active', `user:${user.id}`, 30, 60)
    if (!allowed) return NextResponse.json({ active: null }, { status: 429 })

    const service = getServiceSupabase()
    const pendingSince = new Date(Date.now() - PENDING_WINDOW_MIN * 60_000).toISOString()
    const confirmedSince = new Date(Date.now() - CONFIRMED_WINDOW_MIN * 60_000).toISOString()

    const { data: pendingRows } = await service
      .from('bookings')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'payment_review'])
      .not('provider_order_no', 'is', null)
      .gte('created_at', pendingSince)
      .order('created_at', { ascending: false })
      .limit(1)
    let row = (pendingRows ?? [])[0] as { id: string; status: string } | undefined
    if (!row) {
      const { data: confirmedRows } = await service
        .from('bookings')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'confirmed')
        .gte('updated_at', confirmedSince)
        .order('updated_at', { ascending: false })
        .limit(1)
      row = (confirmedRows ?? [])[0] as { id: string; status: string } | undefined
    }

    return NextResponse.json({ active: row ? { bookingId: row.id, status: row.status } : null })
  } catch (error) {
    console.error('[checkout/active] error', { message: (error as Error).message })
    return NextResponse.json({ active: null })
  }
}
