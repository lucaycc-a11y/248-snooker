'use client'

/**
 * WeatherBookingActions — the two mockup weather flows (§ B5).
 *
 *   resched  — move the booking after a customer WhatsApp request
 *   wcancel  — cancel the booking and grant Space Wallet credit
 *
 * The cancel path calls POST /api/admin/bookings/[id]/cancel with
 * compensationType: 'credit', which is gated by validateWeatherCredit()
 * before any credits_ledger write. That policy is currently unimplemented
 * by design — until it returns { ok: true } the flow stays blocked.
 *
 * CSS-variable only — no inline hex, no shadows.
 */

import { useState, useCallback } from 'react'
import { CalendarClock, CloudRain, Loader2, X } from 'lucide-react'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'

type Mode = 'resched' | 'wcancel' | null

type Props = {
  booking: AdminBookingRow
  onRefresh?: () => void
  onCancelled?: () => void
}

export default function WeatherBookingActions({ booking, onRefresh, onCancelled }: Props) {
  const [mode, setMode] = useState<Mode>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // resched form
  const [whatsappNote, setWhatsappNote] = useState('')
  const [newDate, setNewDate] = useState(booking.date ?? '')
  const [startHour, setStartHour] = useState(12)
  const [durationHours, setDurationHours] = useState(2)
  const [tableNumber, setTableNumber] = useState<1 | 2>(
    (booking.tableNumber === 2 ? 2 : 1) as 1 | 2,
  )

  // wcancel form
  const [cancelReason, setCancelReason] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [differenceReason, setDifferenceReason] = useState('')
  const [cancelWhatsappRef, setCancelWhatsappRef] = useState('')

  const close = useCallback(() => {
    setMode(null)
    setError(null)
    setLoading(false)
  }, [])

  const submitReschedule = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/weather-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNote,
          date: newDate,
          startHour,
          durationHours,
          tableNumber,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? '改期失敗')
      close()
      onRefresh?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [booking.id, whatsappNote, newDate, startHour, durationHours, tableNumber, close, onRefresh])

  const submitWeatherCancel = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason.trim(),
          whatsappRef: cancelWhatsappRef.trim(),
          compensationType: 'credit',
          compensationValue: Number(creditAmount),
          differenceReason: differenceReason.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? '取消失敗')
      close()
      onCancelled?.()
      onRefresh?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [booking.id, cancelReason, creditAmount, differenceReason, cancelWhatsappRef, close, onCancelled, onRefresh])

  const isCancelled =
    booking.status === 'admin_cancelled' || booking.status === 'refunded'

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    borderRadius: 'var(--admin-radius-btn)',
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-glass-bg)',
    padding: '0.625rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--admin-text-muted)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 'var(--admin-radius-btn)',
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-bg)',
    color: 'var(--admin-text)',
    fontSize: '0.875rem',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--admin-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
    display: 'block',
  }

  const panelStyle: React.CSSProperties = {
    marginTop: '0.75rem',
    padding: '1rem',
    borderRadius: 'var(--admin-radius-card)',
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-glass-bg)',
  }

  return (
    <div>
      {!isCancelled && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode(mode === 'resched' ? null : 'resched')
            }}
            style={btnStyle}
            data-cms-key="admin.booking.weather_reschedule"
          >
            <CalendarClock size={14} />
            天氣改期
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setMode(mode === 'wcancel' ? null : 'wcancel')
            }}
            style={btnStyle}
            data-cms-key="admin.booking.weather_cancel"
          >
            <CloudRain size={14} />
            天氣取消＋Credit
          </button>
        </div>
      )}

      {/* ── Reschedule panel ─────────────────────────────────────────── */}
      {mode === 'resched' && (
        <div style={panelStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold" style={{ color: 'var(--admin-text)' }} data-cms-key="admin.booking.weather_reschedule">
              天氣改期
            </h4>
            <button type="button" onClick={close} style={{ color: 'var(--admin-text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          <label style={labelStyle} data-cms-key="admin.booking.whatsapp_note_label">
            客戶 WhatsApp 要求紀錄（必填）
          </label>
          <textarea
            rows={2}
            value={whatsappNote}
            onChange={(e) => setWhatsappNote(e.target.value)}
            placeholder="例：客戶於 10/17 14:22 WhatsApp 表示因黑雨要求改期"
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label style={labelStyle} data-cms-key="admin.booking.new_date_label">
                新日期
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} data-cms-key="admin.booking.table_label">
                球桌
              </label>
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(Number(e.target.value) === 2 ? 2 : 1)}
                style={inputStyle}
              >
                <option value={1}>1 號桌</option>
                <option value={2}>2 號桌</option>
              </select>
            </div>
            <div>
              <label style={labelStyle} data-cms-key="admin.booking.start_hour_label">
                開始（時）
              </label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                style={inputStyle}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle} data-cms-key="admin.booking.duration_label">
                時長（小時）
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                style={inputStyle}
              >
                {[1, 2, 3, 4, 5, 6].map((d) => (
                  <option key={d} value={d}>
                    {d} 小時
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--admin-danger)' }}>
              {error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ ...btnStyle, justifyContent: 'center' }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={loading || !whatsappNote.trim() || !newDate}
              onClick={submitReschedule}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{
                ...btnStyle,
                justifyContent: 'center',
                background: 'var(--admin-brand)',
                color: 'var(--admin-bg)',
                border: 'none',
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : '確認改期'}
            </button>
          </div>
        </div>
      )}

      {/* ── Weather cancel + credit panel ────────────────────────────── */}
      {mode === 'wcancel' && (
        <div style={panelStyle}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold" style={{ color: 'var(--admin-text)' }} data-cms-key="admin.booking.weather_cancel">
              天氣取消＋Credit
            </h4>
            <button type="button" onClick={close} style={{ color: 'var(--admin-text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          <label style={labelStyle} data-cms-key="admin.booking.cancel_reason_label">
            取消原因
          </label>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="例：黑色暴雨警告，場地關閉"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '0.75rem' }} data-cms-key="admin.booking.credit_amount_label">
            Credit 金額（HK$）
          </label>
          <input
            type="number"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
            placeholder={`已付金額 HK$ ${booking.price ?? 0}`}
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '0.75rem' }} data-cms-key="admin.booking.difference_reason_label">
            與已付金額不同時的原因
          </label>
          <input
            type="text"
            value={differenceReason}
            onChange={(e) => setDifferenceReason(e.target.value)}
            placeholder="金額與訂單相同時可留空"
            style={inputStyle}
          />

          <label style={{ ...labelStyle, marginTop: '0.75rem' }} data-cms-key="admin.booking.whatsapp_ref_label">
            WhatsApp 聯絡參考
          </label>
          <input
            type="text"
            value={cancelWhatsappRef}
            onChange={(e) => setCancelWhatsappRef(e.target.value)}
            placeholder="客戶 WhatsApp 對話參考，例如訊息時間或截圖編號"
            style={inputStyle}
          />

          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--admin-danger)' }}>
              {error}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ ...btnStyle, justifyContent: 'center' }}
            >
              取消
            </button>
            <button
              type="button"
              disabled={loading || !cancelReason.trim() || !creditAmount || cancelWhatsappRef.trim().length < 3}
              onClick={submitWeatherCancel}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{
                ...btnStyle,
                justifyContent: 'center',
                background: 'var(--admin-danger)',
                color: 'var(--admin-bg)',
                border: 'none',
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : '確認取消'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
