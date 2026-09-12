// UAT delete test bookings endpoint - deletes only is_test=true bookings for current user
// ONLY accessible when NEXT_PUBLIC_APP_ENV === 'uat'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Delete only is_test=true bookings for this user
    // Server-side enforcement: never touch is_test=false rows
    const { data: deletedBookings, error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('user_id', user.id)
      .eq('is_test', true)
      .select()

    if (deleteError) throw deleteError

    return NextResponse.json({
      deletedCount: deletedBookings?.length || 0,
    })
  } catch (error) {
    console.error('[uat/delete-test-bookings] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
