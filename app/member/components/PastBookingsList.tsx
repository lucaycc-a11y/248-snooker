'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileText, CircleDot } from 'lucide-react'
import { getTableName } from '@/lib/booking/constants'
import { useLocale } from 'next-intl'

// ════════════════════════════════════════════════════════════════════════════
// PastBookingsList — Read-only history link
// No self-serve cancel/reschedule — per refund policy, direct to WhatsApp
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

export function PastBookingsList({ userId }: Props) {
  const locale = useLocale()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPast()
  }, [])

  const loadPast = async () => {
    try {
      const res = await fetch('/api/member/bookings')
      if (res.ok) {
        const data = await res.json()
        const all = data.bookings ?? []

        // Past = completed or date in past
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
          .slice(0, 5) // Show last 5

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
      <div className="flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
          <FileText className="h-8 w-8 text-white/30" strokeWidth={1.5} />
        </div>
        <p className="mt-4 text-sm text-white/60">暫無歷史預約</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/80">過往預約</h3>
          <a
            href="/member/bookings/history"
            className="text-xs text-white/60 transition-colors hover:text-white"
          >
            查看全部 →
          </a>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {bookings.map((booking) => {
          const bookingDate = booking.date ? new Date(booking.date) : null

          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 transition-colors hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CircleDot className="h-5 w-5 text-white" strokeWidth={1.5} />
                    <p className="font-medium text-white">
                      {booking.tableId ? getTableName(parseInt(booking.tableId), locale) : '--'}
                    </p>
                  </div>
                  {bookingDate && (
                    <p className="mt-1 text-xs text-white/50">
                      {bookingDate.toLocaleDateString('zh-HK', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                      {' · '}
                      {booking.startTime}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-code text-sm font-medium text-white">
                    HK${booking.price.toLocaleString()}
                  </p>
                  <p className="font-code text-xs text-white/40">{booking.durationHours}小時</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <div className="border-t border-white/10 bg-white/5 p-4 text-center">
        <p className="text-xs text-white/50">
          需要改期或退款？
          <a
            href="https://wa.me/85261808022"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-[#22c55e] underline"
          >
            WhatsApp 聯絡我們
          </a>
        </p>
      </div>
    </div>
  )
}
