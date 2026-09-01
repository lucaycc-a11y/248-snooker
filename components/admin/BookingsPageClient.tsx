'use client'

/**
 * BookingsPageClient — client wrapper for the bookings page.
 * Manages BookingDrawer + ManualBookingWizard state and refresh.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import BookingTable from '@/components/admin/BookingTable'
import BookingDrawer from '@/components/admin/BookingDrawer'
import ManualBookingWizard from '@/components/admin/ManualBookingWizard'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'

type ApiResponse = { bookings: AdminBookingRow[]; total: number; page: number; pageSize: number }

export default function BookingsPageClient({ initial }: { initial: ApiResponse }) {
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showWizard, setShowWizard] = useState(false)

  return (
    <>
      {/* ── Manual Booking CTA ─────────────────────────────────────── */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--admin-brand)] px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity"
          data-cms-key="admin_bookings_manual_cta"
        >
          <Plus size={16} />
          Manual Booking
        </button>
      </div>

      <BookingTable
        initial={initial}
        refreshKey={refreshKey}
        onSelectBooking={setSelectedBookingId}
      />
      <BookingDrawer
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {/* ── Manual Booking Wizard Modal ────────────────────────────── */}
      {showWizard && (
        <ManualBookingWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </>
  )
}
