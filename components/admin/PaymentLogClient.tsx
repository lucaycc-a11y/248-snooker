'use client'

/**
 * PaymentLogClient — interactive payment log with anomaly detection.
 * Completely new design — no legacy table patterns.
 *
 * Features:
 * - Card-based payment rows with status chips
 * - Anomaly flags (orphaned / no_match / unconfirmed)
 * - One-click reconciliation (link payment → booking)
 * - Status filter + date range + anomaly-only toggle
 * - Paginated with smooth transitions
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  Link as LinkIcon,
  Search,
  X,
  Check,
  Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

type PaymentEntry = {
  id: string
  bookingId: string
  provider: string
  providerOrderNo: string | null
  status: string
  failureCode: string | null
  failureReason: string | null
  amount: number
  createdAt: string
  completedAt: string | null
  anomaly: 'orphaned' | 'no_match' | 'unconfirmed' | null
}

type ApiResponse = {
  payments: PaymentEntry[]
  total: number
  page: number
  pageSize: number
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatHKD(cents: number): string {
  return `HK$${(cents / 100).toFixed(2)}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusColor(s: string): string {
  switch (s) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
    case 'pending':
      return 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
    case 'failed':
      return 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
    case 'cancelled':
      return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
    default:
      return 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30'
  }
}

function anomalyBadge(a: PaymentEntry['anomaly']): { label: string; className: string } | null {
  switch (a) {
    case 'orphaned':
      return {
        label: 'Orphaned — no booking linked',
        className: 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40',
      }
    case 'no_match':
      return {
        label: 'No matching booking',
        className: 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40',
      }
    case 'unconfirmed':
      return {
        label: 'Booking not confirmed',
        className: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40',
      }
    default:
      return null
  }
}

// ── Reconcile Modal ────────────────────────────────────────────────────

function ReconcileModal({
  payment,
  onClose,
  onDone,
}: {
  payment: PaymentEntry
  onClose: () => void
  onDone: () => void
}) {
  const [bookingQuery, setBookingQuery] = useState('')
  const [results, setResults] = useState<{ id: string; humanCode: string; status: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchBookings = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/bookings?search=${encodeURIComponent(q)}&pageSize=8`)
      const data = await res.json()
      setResults(
        (data.bookings ?? []).map((b: Record<string, unknown>) => ({
          id: String(b.id ?? ''),
          humanCode: String(b.humanCode ?? ''),
          status: String(b.status ?? ''),
        })),
      )
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchBookings(bookingQuery), 250)
    return () => clearTimeout(timer)
  }, [bookingQuery, searchBookings])

  const handleReconcile = async () => {
    if (!selectedId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payment-log/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, bookingId: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Reconciliation failed')
        return
      }
      onDone()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl bg-[var(--admin-surface)] border border-[var(--admin-border)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--admin-text)]">
            Reconcile Payment
          </h3>
          <button onClick={onClose} className="text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 rounded-xl bg-[var(--admin-surface-elevated)] p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--admin-text-muted)]">Payment ID</span>
            <span className="font-mono text-[var(--admin-text)] text-xs">{payment.id.slice(0, 12)}…</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[var(--admin-text-muted)]">Amount</span>
            <span className="font-medium text-[var(--admin-text)]">{formatHKD(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[var(--admin-text-muted)]">Provider</span>
            <span className="text-[var(--admin-text)]">{payment.provider}</span>
          </div>
        </div>

        <label className="block text-sm font-medium text-[var(--admin-text-muted)] mb-2">
          Search booking to link
        </label>
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-faint)]" />
          <input
            type="text"
            value={bookingQuery}
            onChange={(e) => setBookingQuery(e.target.value)}
            placeholder="Booking code or reference…"
            className="w-full rounded-xl bg-[var(--admin-surface-elevated)] border border-[var(--admin-border)] pl-10 pr-4 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-brand)]/40"
          />
          {loading && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--admin-text-faint)]" />
          )}
        </div>

        {results.length > 0 && (
          <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-[var(--admin-border)] divide-y divide-[var(--admin-border)]">
            {results.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                  selectedId === b.id
                    ? 'bg-[var(--admin-brand)]/10 text-[var(--admin-brand)]'
                    : 'text-[var(--admin-text)] hover:bg-[var(--admin-surface-hover)]'
                }`}
              >
                <span className="font-mono">{b.humanCode}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>
                  {b.status}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mb-3 text-sm text-red-400">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReconcile}
            disabled={!selectedId || submitting}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--admin-brand)] text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
            Link to Booking
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

const STATUS_OPTIONS = ['completed', 'pending', 'failed', 'cancelled'] as const

export default function PaymentLogClient() {
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [anomalyOnly, setAnomalyOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reconcileTarget, setReconcileTarget] = useState<PaymentEntry | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pageSize = 30
  const totalPages = Math.ceil(total / pageSize)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (statusFilter) params.set('status', statusFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (anomalyOnly) params.set('anomaly', '1')

      const res = await fetch(`/api/admin/payment-log?${params}`)
      const data: ApiResponse = await res.json()
      setPayments(data.payments)
      setTotal(data.total)
    } catch {
      setPayments([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, dateFrom, dateTo, anomalyOnly])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, dateFrom, dateTo, anomalyOnly])

  const anomalyCount = payments.filter((p) => p.anomaly !== null).length

  return (
    <>
      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Status chips */}
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-[var(--admin-text-faint)]" />
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === null
                ? 'bg-[var(--admin-brand)] text-black'
                : 'bg-[var(--admin-surface-elevated)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
            }`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--admin-brand)] text-black'
                  : 'bg-[var(--admin-surface-elevated)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl bg-[var(--admin-surface-elevated)] border border-[var(--admin-border)] px-3 py-1.5 text-xs text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-brand)]/40"
          />
          <span className="text-[var(--admin-text-faint)] text-xs">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl bg-[var(--admin-surface-elevated)] border border-[var(--admin-border)] px-3 py-1.5 text-xs text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-brand)]/40"
          />
        </div>

        {/* Anomaly toggle */}
        <button
          onClick={() => setAnomalyOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            anomalyOnly
              ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/40'
              : 'bg-[var(--admin-surface-elevated)] text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
          }`}
        >
          <AlertTriangle size={12} />
          Anomalies{anomalyCount > 0 && ` (${anomalyCount})`}
        </button>

        <div className="ml-auto text-xs text-[var(--admin-text-faint)]">
          {total} records
        </div>
      </div>

      {/* ── Payment List ───────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--admin-brand)] border-t-transparent" />
        </div>
      ) : payments.length === 0 ? (
        <div className="py-24 text-center text-[var(--admin-text-muted)]">
          <p className="text-sm">No payment records found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const badge = anomalyBadge(p.anomaly)
            const isExpanded = expandedId === p.id

            return (
              <motion.div
                key={p.id}
                layout
                className={`rounded-2xl border transition-colors ${
                  p.anomaly
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-[var(--admin-border)] bg-[var(--admin-surface)]'
                }`}
              >
                {/* ── Row ─────────────────────────────────────────────── */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  {/* Status dot */}
                  <div
                    className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                      p.status === 'completed'
                        ? 'bg-emerald-400'
                        : p.status === 'failed'
                          ? 'bg-red-400'
                          : p.status === 'pending'
                            ? 'bg-amber-400'
                            : 'bg-zinc-500'
                    }`}
                  />

                  {/* Provider + amount */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--admin-text)] capitalize">
                        {p.provider}
                      </span>
                      <span className="font-mono text-sm text-[var(--admin-text)]">
                        {formatHKD(p.amount)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--admin-text-muted)]">
                      <span className="font-mono">{p.id.slice(0, 8)}…</span>
                      <span>·</span>
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>

                  {/* Status chip */}
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor(p.status)}`}>
                    {p.status}
                  </span>

                  {/* Anomaly badge */}
                  {badge && (
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${badge.className}`}>
                      <AlertTriangle size={11} />
                      {badge.label}
                    </span>
                  )}

                  {/* Expand chevron */}
                  <ChevronRight
                    size={16}
                    className={`text-[var(--admin-text-faint)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* ── Expanded Detail ────────────────────────────────── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[var(--admin-border)] px-5 py-4 space-y-3">
                        {/* Detail grid */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                          <Detail label="Payment ID" value={p.id} mono />
                          <Detail label="Provider Order" value={p.providerOrderNo ?? '—'} mono />
                          <Detail label="Booking ID" value={p.bookingId ? `${p.bookingId.slice(0, 8)}…` : '—'} mono />
                          <Detail label="Completed" value={p.completedAt ? formatDate(p.completedAt) : '—'} />
                          {p.failureCode && (
                            <Detail label="Failure Code" value={p.failureCode} />
                          )}
                          {p.failureReason && (
                            <Detail label="Failure Reason" value={p.failureReason} className="col-span-2" />
                          )}
                        </div>

                        {/* Anomaly actions */}
                        {p.anomaly && (
                          <div className="flex items-center gap-3 pt-2">
                            {badge && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${badge.className}`}>
                                <AlertTriangle size={12} />
                                {badge.label}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setReconcileTarget(p)
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--admin-brand)] text-xs font-medium text-black hover:opacity-90 transition-opacity"
                            >
                              <LinkIcon size={12} />
                              Reconcile
                            </button>
                          </div>
                        )}

                        {/* Booking link (if linked) */}
                        {p.bookingId && !p.anomaly && (
                          <div className="pt-2">
                            <a
                              href={`/admin/bookings/${p.bookingId}`}
                              className="inline-flex items-center gap-1.5 text-xs text-[var(--admin-brand)] hover:underline"
                            >
                              <ExternalLink size={12} />
                              View linked booking
                            </a>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span className="text-sm text-[var(--admin-text-muted)]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] disabled:opacity-30 transition-colors"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Reconcile Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {reconcileTarget && (
          <ReconcileModal
            payment={reconcileTarget}
            onClose={() => setReconcileTarget(null)}
            onDone={() => {
              setReconcileTarget(null)
              fetchPayments()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Detail helper ──────────────────────────────────────────────────────

function Detail({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-[var(--admin-text-faint)] text-xs">{label}</dt>
      <dd className={`mt-0.5 text-[var(--admin-text)] text-sm ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
