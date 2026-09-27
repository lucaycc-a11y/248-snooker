'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CircleDot, Calendar } from 'lucide-react'
import { getTableName } from '@/lib/booking/constants'
import { useLocale, useTranslations } from 'next-intl'

// ════════════════════════════════════════════════════════════════════════════
// BookingHistoryClient — Full booking history list
// Paginated view of all user's past bookings
// ════════════════════════════════════════════════════════════════════════════

type Booking = {
  id: string
  tableId: string | null
  date: string | null
  startTime: string | null
  durationHours: number
  price: number
  humanCode: string
  status: string
}

type Props = {
  userId: string
}

export function BookingHistoryClient({ userId }: Props) {
  const locale = useLocale()
  const t = useTranslations('member')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/member/bookings')
      if (res.ok) {
        const data = await res.json()
        const all = data.bookings ?? []

        // All past bookings (completed or date in past)
        const now = new Date()
        const past = all
          .filter((b: Booking) => {
            if (b.status === 'completed') return true
            if (b.date && new Date(b.date) < now) return true
            return false
          })
          .sort((a: Booking, b: Booking) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0
            const dateB = b.date ? new Date(b.date).getTime() : 0
            return dateB - dateA // newest first
          })

        setBookings(past)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a
              href="/member"
              className="text-white/60 transition-colors hover:text-white"
              aria-label="返回我的帳戶"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">{t('past_bookings.title')}</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {bookings.length === 0 ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                <Calendar className="h-10 w-10 text-white/30" strokeWidth={1.5} />
              </div>
              <p className="mt-6 text-white/60">{t('past_bookings.no_history')}</p>
              <a
                href="/book"
                className="mt-6 inline-block rounded-full bg-[#22c55e] px-6 py-2.5 font-code text-sm font-medium text-white transition-all hover:bg-[#16a34a]"
              >
                {t('upcoming_booking.book_now')}
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {bookings.map((booking, index) => {
                const bookingDate = booking.date ? new Date(booking.date) : null

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 transition-colors hover:border-white/20"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <CircleDot className="h-6 w-6 text-white" strokeWidth={1.5} />
                          <div>
                            <h3 className="text-lg font-bold text-white">
                              {booking.tableId ? getTableName(parseInt(booking.tableId), locale) : '--'}
                            </h3>
                            {bookingDate && (
                              <p className="mt-1 text-sm text-white/60">
                                {bookingDate.toLocaleDateString('zh-HK', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  weekday: 'short'
                                })}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex gap-6">
                          <div>
                            <p className="text-xs text-white/40">{t('upcoming_booking.time')}</p>
                            <p className="font-code mt-1 text-sm font-medium text-white">{booking.startTime ?? '--'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-white/40">{t('upcoming_booking.duration')}</p>
                            <p className="font-code mt-1 text-sm font-medium text-white">
                              {booking.durationHours}{t('upcoming_booking.hours')}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-code text-xl font-bold text-white">
                          HK${booking.price.toLocaleString()}
                        </p>
                        <p className="font-code mt-1 text-xs text-white/40">{booking.humanCode}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Contact Support Footer */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 text-center">
              <p className="text-sm text-white/60">
                {t('past_bookings.whatsapp_prompt')}
                <a
                  href="https://wa.me/85261808022"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-[#22c55e] underline"
                >
                  {t('past_bookings.whatsapp_cta')}
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
