/**
 * BookingDrawer — §6.2 Booking detail drawer.
 *
 * Slide-in from right (desktop), full-screen (mobile).
 * Tabs: Details | Payments | Audit Log
 * Action buttons: Cancel, Mark Test, Add Points (future), Waive Fee (future)
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  User,
  Calendar,
  CreditCard,
  Clock,
  AlertTriangle,
  FileText,
  ToggleLeft,
  ToggleRight,
  Ban,
  Loader2,
} from 'lucide-react'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'

/* ── Types ─────────────────────────────────────────────────────────── */

type BookingDrawerProps = {
  bookingId: string | null
  onClose: () => void
  onRefresh?: () => void
}

type Tab = 'details' | 'payments' | 'audit'

type PaymentAttempt = {
  id: string
  bookingId: string
  orderGroupId: string | null
  provider: string
  providerOrderNo: string | null
  status: string
  failureCode: string | null
  failureReason: string | null
  idempotencyKey: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

type AuditEntry = {
  id: string
  adminEmail: string
  actionType: string
  targetTable: string | null
  targetId: string | null
  beforeJsonb: Record<string, unknown> | null
  afterJsonb: Record<string, unknown> | null
  riskLevel: string
  createdAt: string
}

type CancellationRecord = {
  id: string
  reason: string
  compensationType: string
  compensationValue: number
  createdAt: string
}

type PaymentApiResponse = { payments: PaymentAttempt[] }
type AuditApiResponse = { entries: AuditEntry[] }

/* ── Status helpers ────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-[var(--admin-brand)]/15 text-[var(--admin-brand)]',
  pending: 'bg-amber-500/15 text-amber-400',
  refunded: 'bg-red-500/15 text-red-400',
  admin_cancelled: 'bg-purple-500/15 text-purple-400',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-[var(--admin-glass-bg)] text-[var(--admin-text-muted)]'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  succeeded: 'bg-emerald-500/15 text-emerald-400',
  claimed: 'bg-blue-500/15 text-blue-400',
  pending: 'bg-amber-500/15 text-amber-400',
  failed: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-zinc-500/15 text-zinc-400',
  expired: 'bg-zinc-500/15 text-zinc-400',
}

function PaymentStatusBadge({ status }: { status: string }) {
  const cls = PAYMENT_STATUS_STYLES[status] ?? 'bg-[var(--admin-glass-bg)] text-[var(--admin-text-muted)]'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  )
}

/* ── Format helpers ────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-HK', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`
}

function formatCurrency(hkd: number): string {
  return `$${hkd.toLocaleString('en-HK')}`
}

/* ── Detail row helper ─────────────────────────────────────────────── */

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-[var(--admin-border)]/50 last:border-0">
      <span className="text-xs text-[var(--admin-text-muted)] shrink-0" data-cms-key={`admin_booking_detail_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`}>
        {label}
      </span>
      <span className={`text-sm text-[var(--admin-text)] text-right ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────────── */

export default function BookingDrawer({ bookingId, onClose, onRefresh }: BookingDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('details')
  const [payments, setPayments] = useState<PaymentAttempt[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([])
  const [markingTest, setMarkingTest] = useState(false)
  const [booking, setBooking] = useState<AdminBookingRow | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Load booking data when bookingId changes
  useEffect(() => {
    if (!bookingId) {
      setBooking(null)
      return
    }
    setBookingLoading(true)
    setActiveTab('details')
    setPayments([])
    setAuditEntries([])
    setCancellations([])

    // Fetch full booking details
    fetch(`/api/admin/bookings?page=1&search=${bookingId}`)
      .then((res) => res.json())
      .then((json: { bookings: AdminBookingRow[] }) => {
        const found = json.bookings.find((b) => b.id === bookingId)
        if (found) setBooking(found)
      })
      .catch(() => { /* stay null */ })
      .finally(() => setBookingLoading(false))
  }, [bookingId])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && bookingId) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bookingId, onClose])

  // Fetch payments when tab is activated
  const fetchPayments = useCallback(async () => {
    if (!bookingId || payments.length > 0) return
    setPaymentsLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/payments`)
      if (res.ok) {
        const json: PaymentApiResponse = await res.json()
        setPayments(json.payments)
      }
    } catch { /* ignore */ }
    finally { setPaymentsLoading(false) }
  }, [bookingId, payments.length])

  // Fetch audit log when tab is activated
  const fetchAudit = useCallback(async () => {
    if (!bookingId || auditEntries.length > 0) return
    setAuditLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/audit-log`)
      if (res.ok) {
        const json: AuditApiResponse = await res.json()
        setAuditEntries(json.entries)
      }
    } catch { /* ignore */ }
    finally { setAuditLoading(false) }
  }, [bookingId, auditEntries.length])

  // Tab change handler with lazy fetch
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab)
    if (tab === 'payments') fetchPayments()
    if (tab === 'audit') fetchAudit()
  }, [fetchPayments, fetchAudit])

  // Mark/unmark test
  const handleToggleTest = useCallback(async () => {
    if (!booking) return
    setMarkingTest(true)
    try {
      await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.id, is_test: !booking.isTest }),
      })
      setBooking({ ...booking, isTest: !booking.isTest })
      onRefresh?.()
    } finally {
      setMarkingTest(false)
    }
  }, [booking, onRefresh])

  // Cancel handler — delegates to existing cancel flow
  const handleCancel = useCallback(async () => {
    if (!booking) return
    const reason = window.prompt('Cancel reason (required):')
    if (!reason || reason.trim().length === 0) return
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: reason.trim() }),
      })
      if (res.ok) {
        setBooking({ ...booking, status: 'admin_cancelled' })
        onRefresh?.()
      }
    } catch { /* ignore */ }
  }, [booking, onRefresh])

  // Don't render anything if no booking selected
  if (!bookingId) return null

  const displayCode = booking?.humanCode ?? booking?.bookingReference ?? bookingId.slice(0, 8)
  const userName = booking?.userName ?? booking?.userEmail ?? 'Guest'

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'details', label: 'Details', icon: FileText },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'audit', label: 'Audit Log', icon: Clock },
  ]

  return createPortal(
    <AnimatePresence>
      {bookingId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="booking-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            ref={drawerRef}
            key="booking-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[560px] bg-[var(--admin-surface)] border-l border-[var(--admin-border)] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--admin-border)] shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--admin-text)]">
                    {displayCode}
                  </span>
                  {booking?.isTest && (
                    <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 leading-none">
                      TEST
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--admin-text-muted)] mt-0.5 truncate">{userName}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-[var(--admin-glass-bg)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--admin-border)] shrink-0">
              {tabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => handleTabChange(key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === key
                      ? 'border-[var(--admin-brand)] text-[var(--admin-brand)]'
                      : 'border-transparent text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
                  }`}
                >
                  <Icon size={14} />
                  <span data-cms-key={`admin_booking_tab_${key}`}>{label}</span>
                </button>
              ))}
            </div>

            {/* Content area — scrollable */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details' && (
                <DetailsTab
                  booking={booking}
                  loading={bookingLoading}
                  cancellations={cancellations}
                  onToggleTest={handleToggleTest}
                  onCancel={handleCancel}
                  markingTest={markingTest}
                />
              )}
              {activeTab === 'payments' && (
                <PaymentsTab
                  payments={payments}
                  loading={paymentsLoading}
                />
              )}
              {activeTab === 'audit' && (
                <AuditTab
                  entries={auditEntries}
                  loading={auditLoading}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

/* ── Details tab ───────────────────────────────────────────────────── */

function DetailsTab({
  booking,
  loading,
  cancellations,
  onToggleTest,
  onCancel,
  markingTest,
}: {
  booking: AdminBookingRow | null
  loading: boolean
  cancellations: CancellationRecord[]
  onToggleTest: () => void
  onCancel: () => void
  markingTest: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--admin-text-muted)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--admin-text-muted)]">
        <span className="text-sm">Booking not found</span>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-6">
      {/* Booking info */}
      <section>
        <h3 className="text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider mb-3" data-cms-key="admin_booking_detail_booking_info">
          Booking Info
        </h3>
        <div className="rounded-xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)] px-4 py-2">
          <DetailRow label="Status" value={<StatusBadge status={booking.status} />} />
          <DetailRow label="Table" value={`Table ${booking.tableNumber}`} />
          <DetailRow label="Date" value={booking.date ?? '—'} />
          <DetailRow label="Time" value={booking.startTime && booking.endTime ? `${booking.startTime} – ${booking.endTime}` : booking.startTime ?? '—'} />
          <DetailRow label="Amount" value={<span className="font-code">{formatCurrency(booking.price)} HKD</span>} mono />
          <DetailRow label="Payment" value={booking.paymentMethod ?? '—'} />
          <DetailRow label="Code" value={booking.humanCode ?? booking.bookingReference ?? '—'} mono />
          {booking.isTest && (
            <div className="flex items-center gap-2 py-2.5">
              <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400">
                TEST BOOKING
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Customer info */}
      <section>
        <h3 className="text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider mb-3" data-cms-key="admin_booking_detail_customer_info">
          Customer
        </h3>
        <div className="rounded-xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)] px-4 py-2">
          <DetailRow label="Name" value={booking.userName ?? '—'} />
          <DetailRow label="Email" value={booking.userEmail ?? '—'} />
          <DetailRow label="Phone" value={booking.userPhone ?? '—'} mono />
        </div>
      </section>

      {/* Cancellation reasons (if any) */}
      {cancellations.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider mb-3" data-cms-key="admin_booking_detail_cancellation_reasons">
            Cancellation Reasons
          </h3>
          <div className="space-y-2">
            {cancellations.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-[var(--admin-text)]">{c.reason}</p>
                    <p className="text-xs text-[var(--admin-text-muted)] mt-1">
                      {formatDateTime(c.createdAt)}
                      {c.compensationType !== 'none' && (
                        <span className="ml-2 text-amber-400">
                          · {c.compensationType}: {c.compensationType === 'points' ? `${c.compensationValue} pts` : formatCurrency(c.compensationValue)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section>
        <h3 className="text-xs font-semibold text-[var(--admin-text-muted)] uppercase tracking-wider mb-3" data-cms-key="admin_booking_detail_actions">
          Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          {booking.status !== 'admin_cancelled' && booking.status !== 'refunded' && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <Ban size={14} />
              <span data-cms-key="admin_booking_action_cancel">Cancel</span>
            </button>
          )}
          <button
            onClick={onToggleTest}
            disabled={markingTest}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-glass-bg)] px-4 py-2.5 text-sm font-medium text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[var(--admin-text-muted)] transition-colors disabled:opacity-40"
          >
            {markingTest ? (
              <Loader2 size={14} className="animate-spin" />
            ) : booking.isTest ? (
              <ToggleRight size={14} className="text-[var(--admin-brand)]" />
            ) : (
              <ToggleLeft size={14} />
            )}
            <span data-cms-key="admin_booking_action_mark_test">
              {booking.isTest ? 'Unmark Test' : 'Mark Test'}
            </span>
          </button>
          {/* Future: Add Points, Waive Fee buttons */}
        </div>
      </section>
    </div>
  )
}

/* ── Payments tab ──────────────────────────────────────────────────── */

function PaymentsTab({
  payments,
  loading,
}: {
  payments: PaymentAttempt[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--admin-text-muted)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="m-5 rounded-2xl border-2 border-red-500/40 bg-red-500/10 p-5 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-300" data-cms-key="admin_booking_payment_empty_title">
              此訂單無任何付款記錄
            </h4>
            <p className="mt-1 text-xs text-red-300/80 leading-relaxed">
              資料庫未找到任何 payment_attempts 紀錄與此訂單對應。請檢查 webhook 回調是否成功、客戶是否透過其他渠道付款、或是否需要手動建立對應記錄。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-3">
      {payments.map((p) => (
        <div
          key={p.id}
          className="rounded-xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)] px-4 py-3"
        >
          <div className="flex items-center justify-between mb-2">
            <PaymentStatusBadge status={p.status} />
            <span className="text-xs text-[var(--admin-text-muted)] font-mono tabular-nums">
              {formatDateTime(p.createdAt)}
            </span>
          </div>

          <div className="space-y-1.5">
            {p.providerOrderNo && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--admin-text-muted)]">Provider Order</span>
                <span className="font-mono text-[var(--admin-text)]">{p.providerOrderNo}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--admin-text-muted)]">Provider</span>
              <span className="text-[var(--admin-text)]">{p.provider}</span>
            </div>
            {p.failureCode && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--admin-text-muted)]">Failure Code</span>
                <span className="font-mono text-red-400">{p.failureCode}</span>
              </div>
            )}
            {p.failureReason && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--admin-text-muted)]">Failure Reason</span>
                <span className="text-red-400 text-right max-w-[280px]">{p.failureReason}</span>
              </div>
            )}
            {p.completedAt && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--admin-text-muted)]">Completed</span>
                <span className="font-mono text-[var(--admin-text)]">{formatDateTime(p.completedAt)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Audit Log tab ─────────────────────────────────────────────────── */

function AuditTab({
  entries,
  loading,
}: {
  entries: AuditEntry[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--admin-text-muted)]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--admin-text-muted)]">
        <Clock size={32} className="mb-3 opacity-40" />
        <span className="text-sm">No audit entries found</span>
      </div>
    )
  }

  const RISK_STYLES: Record<string, string> = {
    low: 'bg-emerald-500/15 text-emerald-400',
    medium: 'bg-amber-500/15 text-amber-400',
    high: 'bg-red-500/15 text-red-400',
  }

  return (
    <div className="p-5 space-y-3">
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)] px-4 py-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-[var(--admin-text)] truncate">
                {e.actionType}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none ${RISK_STYLES[e.riskLevel] ?? 'bg-zinc-500/15 text-zinc-400'}`}>
                {e.riskLevel}
              </span>
            </div>
            <span className="text-xs text-[var(--admin-text-muted)] font-mono tabular-nums shrink-0 ml-2">
              {formatDateTime(e.createdAt)}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--admin-text-muted)]">Admin</span>
              <span className="text-[var(--admin-text)]">{e.adminEmail}</span>
            </div>
            {e.targetTable && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--admin-text-muted)]">Target</span>
                <span className="font-mono text-[var(--admin-text)]">{e.targetTable}{e.targetId ? ` / ${e.targetId.slice(0, 8)}` : ''}</span>
              </div>
            )}
          </div>

          {/* Show before/after diff if present */}
          {(e.beforeJsonb || e.afterJsonb) && (
            <div className="mt-2.5 pt-2.5 border-t border-[var(--admin-border)]/50">
              <div className="grid grid-cols-2 gap-2">
                {e.beforeJsonb && (
                  <div>
                    <span className="text-[10px] text-[var(--admin-text-muted)] uppercase tracking-wider">Before</span>
                    <pre className="mt-1 text-[11px] font-mono text-red-400/80 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(e.beforeJsonb, null, 1)}
                    </pre>
                  </div>
                )}
                {e.afterJsonb && (
                  <div>
                    <span className="text-[10px] text-[var(--admin-text-muted)] uppercase tracking-wider">After</span>
                    <pre className="mt-1 text-[11px] font-mono text-emerald-400/80 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(e.afterJsonb, null, 1)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
