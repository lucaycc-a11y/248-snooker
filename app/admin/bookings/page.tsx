import { getAdminBookings } from '@/lib/data/getAdminBookings'
import BookingsPageClient from '@/components/admin/BookingsPageClient'

export const metadata = { title: 'Bookings — Space8 Admin' }

export default async function AdminBookingsPage() {
  const initial = await getAdminBookings({ page: 1 })

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 lg:px-8">
      <h1
        className="text-2xl font-bold text-[var(--admin-text)] lg:text-3xl"
        data-cms-key="admin_bookings_title"
      >
        Bookings
      </h1>
      <BookingsPageClient initial={initial} />
    </main>
  )
}
