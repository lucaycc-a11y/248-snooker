import { getAdminBookings } from '@/lib/data/getAdminBookings'
import BookingsPageClient from '@/components/admin/BookingsPageClient'

export const metadata = { title: '預約 — Space8 後台' }
export const dynamic = 'force-dynamic'

// The shell prints the page title; this page only renders the list. The first
// paint excludes test bookings (getAdminBookings default).
export default async function AdminBookingsPage() {
  const initial = await getAdminBookings({ page: 1 })
  return <BookingsPageClient initial={initial} />
}
