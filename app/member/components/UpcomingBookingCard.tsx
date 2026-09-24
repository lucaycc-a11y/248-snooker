'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'

// ════════════════════════════════════════════════════════════════════════════
// UpcomingBookingCard — Next booking with QR code
// Shows venue, date, time, price — fetches from /api/member/bookings
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

export function UpcomingBookingCard({ userId }: Props) {
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    loadUpcoming()
  }, [])

  const loadUpcoming = async () => {
    try {
      const res = await fetch('/api/member/bookings')
      if (res.ok) {
        const data = await res.json()
        const bookings = data.bookings ?? []

        // Find next upcoming confirmed booking
        const now = new Date()
        const upcoming = bookings
          .filter((b: Booking) =>
            b.status === 'confirmed' &&
            b.date &&
            new Date(b.date) >= now
          )
          .sort((a: Booking, b: Booking) =>
            new Date(a.date!).getTime() - new Date(b.date!).getTime()
          )[0]

        setBooking(upcoming ?? null)
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

  if (!booking) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 text-center">
        <span className="text-4xl opacity-30">📅</span>
        <p className="mt-2 text-sm text-white/60">暫無預約</p>
        <a
          href="/booking"
          className="mt-4 inline-block rounded-full bg-[#22c55e] px-6 py-2 text-sm font-medium text-white transition-all hover:bg-[#16a34a]"
        >
          立即預訂
        </a>
      </div>
    )
  }

  const bookingDate = booking.date ? new Date(booking.date) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl"
    >
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/80">即將到來的預約</h3>
          <button
            onClick={() => setShowQR(!showQR)}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20"
          >
            {showQR ? '隱藏' : '顯示'} QR
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎱</span>
              <h4 className="text-xl font-bold text-white">
                球檯 {booking.tableId ?? '--'}
              </h4>
            </div>
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

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-white/40">時間</p>
            <p className="mt-1 font-medium text-white">{booking.startTime ?? '--'}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">時長</p>
            <p className="mt-1 font-medium text-white">{booking.durationHours}小時</p>
          </div>
          <div>
            <p className="text-xs text-white/40">金額</p>
            <p className="mt-1 font-medium text-white">HK${booking.price.toLocaleString()}</p>
          </div>
        </div>

        {showQR && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-6 flex flex-col items-center border-t border-white/10 pt-6"
          >
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={booking.humanCode} size={160} level="H" />
            </div>
            <p className="font-code mt-3 text-sm text-white">{booking.humanCode}</p>
            <p className="mt-1 text-xs text-white/40">入場時出示此碼</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
