import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// POST /api/booking/lock/release
// Frees every active slot lock the CALLING user holds (e.g. an abandoned
// checkout) so they can immediately pick a different time instead of
// waiting out the ~15-minute lock TTL. Scoped to auth.uid() inside the
// release_my_locks() RPC — no slot/order id needed from the client.
export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('booking_lock_release', `user:${user.id}`, 20, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const service = getServiceSupabase()
    const { data, error } = await service.rpc('release_my_locks', { p_user_id: user.id })
    if (error) {
      console.error('[booking/lock/release] rpc_error', { message: error.message, userId: user.id })
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, released: data?.released ?? 0 })
  } catch (err) {
    console.error('[booking/lock/release] error', { message: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
