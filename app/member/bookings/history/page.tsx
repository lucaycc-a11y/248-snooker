import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BookingHistoryClient } from './BookingHistoryClient'

// ════════════════════════════════════════════════════════════════════════════
// Booking History Page — Full list of user's past bookings
// Accessed via "查看全部" link from past bookings preview
// ════════════════════════════════════════════════════════════════════════════

export default async function BookingHistoryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  return <BookingHistoryClient userId={user.id} />
}
