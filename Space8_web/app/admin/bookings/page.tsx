import { getAdminBookings } from '@/lib/data/getAdminBookings'
import BookingTable from '@/components/admin/BookingTable'
import { tokens } from '@/app/styles/tokens'

export default async function AdminBookingsPage() {
  const initial = await getAdminBookings({ page: 1 })

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: tokens.colors.text, marginBottom: 24 }}>Bookings</h1>
      <BookingTable initial={initial} />
    </main>
  )
}
