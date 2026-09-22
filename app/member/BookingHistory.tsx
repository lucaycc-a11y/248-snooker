'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTranslations, useLocale } from 'next-intl'
import { QRCodeSVG } from 'qrcode.react'
import { type MemberBooking } from '@/lib/data/getMember'

// ════════════════════════════════════════════════════════════════════════════
// BookingHistory — P2: Display booking records with QR view
// Shows: upcoming, past, refunded bookings with status badges
// ════════════════════════════════════════════════════════════════════════════

type Props = {
  userId: string
}

export function BookingHistory({ userId }: Props) {
  const t = useTranslations('member.bookings')
  const locale = useLocale()
  const [bookings, setBookings] = useState<MemberBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null)

  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      const res = await fetch('/api/member/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings ?? [])
      }
    } catch {
      /* silent fail */
    } finally {
      setLoading(false)
    }
  }

  const now = new Date()
  const filteredBookings = bookings.filter((b) => {
    if (filter === 'upcoming') {
      return b.date && new Date(b.date) >= now && b.status === 'confirmed'
    }
    if (filter === 'past') {
      return b.date && new Date(b.date) < now
    }
    return true
  })

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {(['all', 'upcoming', 'past'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-label px-4 py-2 text-sm transition-colors ${
              filter === f ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>

      {/* Booking List */}
      {filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-16 text-center backdrop-blur">
          <span className="text-6xl opacity-30">📅</span>
          <p className="mt-4 text-white/60">{t('empty_state')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              locale={locale}
              isSelected={selectedBooking === booking.id}
              onToggleQR={() => setSelectedBooking(selectedBooking === booking.id ? null : booking.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § BOOKING CARD
// ────────────────────────────────────────────────────────────────────────────

type BookingCardProps = {
  booking: MemberBooking
  locale: string
  isSelected: boolean
  onToggleQR: () => void
}

function BookingCard({ booking, locale, isSelected, onToggleQR }: BookingCardProps) {
  const t = useTranslations('member.bookings')

  const isUpcoming = booking.date && new Date(booking.date) >= new Date()
  const statusColor = getStatusColor(booking.status)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-white">
                {t('table')} {booking.tableId ?? '--'}
              </h3>
              <StatusBadge status={booking.status} color={statusColor} />
            </div>
            <p className="mt-1 text-sm text-white/60">
              {booking.date ? new Date(booking.date).toLocaleDateString(locale, { dateStyle: 'full' }) : '--'}
            </p>
          </div>
          {isUpcoming && booking.status === 'confirmed' && (
            <button
              onClick={onToggleQR}
              className="rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20"
            >
              {isSelected ? (
                <span className="text-sm">✕</span>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Details */}
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <DetailItem label={t('time')} value={booking.startTime ?? '--'} />
          <DetailItem label={t('duration')} value={`${booking.durationHours}h`} />
          <DetailItem label={t('price')} value={`HK$${booking.price.toLocaleString()}`} />
          <DetailItem label={t('reference')} value={booking.humanCode} isCode />
        </div>

        {/* Refund/Reschedule Info */}
        {booking.refundedAt && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-300">
              {t('refunded_at')}: {new Date(booking.refundedAt).toLocaleDateString(locale)}
            </p>
            {booking.refundAmount && (
              <p className="mt-1 text-sm text-amber-300/80">
                {t('refund_amount')}: HK${booking.refundAmount.toLocaleString()}
                {booking.refundFee && ` (${t('fee')}: HK$${booking.refundFee.toLocaleString()})`}
              </p>
            )}
          </div>
        )}

        {booking.rescheduledAt && (
          <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
            <p className="text-sm text-blue-300">
              {t('rescheduled_at')}: {new Date(booking.rescheduledAt).toLocaleDateString(locale)}
              {booking.rescheduleCount > 0 && ` (${booking.rescheduleCount}×)`}
            </p>
          </div>
        )}
      </div>

      {/* QR Code View */}
      {isSelected && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-white/10 bg-white/5 p-6"
        >
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={booking.humanCode} size={200} level="H" />
            </div>
            <p className="font-code mt-4 text-lg text-white">{booking.humanCode}</p>
            <p className="font-label mt-1 text-sm text-white/40">{t('scan_to_check_in')}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § UTILITY COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status, color }: { status: string; color: string }) {
  const t = useTranslations('member.bookings')
  return (
    <div className={`font-label rounded-full px-3 py-1 text-xs ${color}`}>
      {t(`status.${status}`)}
    </div>
  )
}

function DetailItem({ label, value, isCode }: { label: string; value: string; isCode?: boolean }) {
  return (
    <div>
      <p className="font-label text-xs text-white/40">{label}</p>
      <p className={`mt-1 font-medium text-white ${isCode ? 'font-code' : ''}`}>{value}</p>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-500/20 text-green-300 border border-green-500/30'
    case 'pending':
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
    case 'payment_failed':
      return 'bg-red-500/20 text-red-300 border border-red-500/30'
    case 'cancelled':
      return 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
    default:
      return 'bg-white/10 text-white/60 border border-white/10'
  }
}
