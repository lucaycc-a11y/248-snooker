'use client'

/**
 * BookingTable — §6.1 rewrite.
 *
 * 5-column table: human_code | user | date+time+venue | amount | status
 * Filter bar: search, status dropdown, date range, test toggle.
 * Pagination at bottom. All Tailwind + CSS variable tokens.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'

type ApiResponse = { bookings: AdminBookingRow[]; total: number; page: number; pageSize: number }

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'admin_cancelled', label: 'Cancelled' },
]

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-[var(--admin-brand)]/15 text-[var(--admin-brand)]',
  pending: 'bg-amber-500/15 text-amber-400',
  refunded: 'bg-red-500/15 text-red-400',
  admin_cancelled: 'bg-purple-500/15 text-purple-400',
}

function statusBadge(status: string) {
  const cls = STATUS_STYLES[status] ?? 'bg-[var(--admin-glass-bg)] text-[var(--admin-text-muted)]'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(d: string | null) {
  if (!d) return '—'
  // Display as YYYY-MM-DD or more readable
  return d
}

function formatTime(start: string | null, end: string | null) {
  if (!start) return '—'
  return end ? `${start}–${end}` : start
}

export default function BookingTable({
  initial,
  refreshKey = 0,
  onSelectBooking,
}: {
  initial: ApiResponse
  refreshKey?: number
  onSelectBooking?: (id: string) => void
}) {
  const [data, setData] = useState(initial)
  const [page, setPage] = useState(initial.page)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showTest, setShowTest] = useState(false)
  const [loading, setLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchPage = useCallback(
    (p: number, s: string, q: string, dFrom: string, dTo: string, testOnly: boolean) => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), isTest: testOnly ? 'true' : 'false' })
      if (s) params.set('status', s)
      if (q) params.set('search', q)
      if (dFrom) params.set('dateFrom', dFrom)
      if (dTo) params.set('dateTo', dTo)
      fetch(`/api/admin/bookings?${params.toString()}`)
        .then((res) => res.json())
        .then((json: ApiResponse) => {
          setData(json)
          setPage(json.page)
        })
        .finally(() => setLoading(false))
    },
    []
  )

  // Refetch when filters change (not search — that's on Enter/button)
  useEffect(() => {
    fetchPage(1, status, search, dateFrom, dateTo, showTest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, showTest, dateFrom, dateTo, refreshKey])

  // Cmd/Ctrl+K focus
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSearch = useCallback(() => {
    fetchPage(1, status, search, dateFrom, dateTo, showTest)
  }, [fetchPage, status, search, dateFrom, dateTo, showTest])

  const toggleTest = useCallback(
    (id: string, next: boolean) => {
      setTogglingId(id)
      fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_test: next }),
      })
        .then(() => fetchPage(page, status, search, dateFrom, dateTo, showTest))
        .finally(() => setTogglingId(null))
    },
    [fetchPage, page, status, search, dateFrom, dateTo, showTest]
  )

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div className="mt-6 space-y-4">
      {/* ── Filter bar ──────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)] px-4 py-3"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search code or reference…"
            data-cms-key="admin_bookings_search_placeholder"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            className="w-full rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] pl-9 pr-3 py-2.5 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] outline-none focus:border-[var(--admin-brand)] transition-colors"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-1.5 py-0.5 text-[10px] text-[var(--admin-text-muted)] font-mono">
            ⌘K
          </kbd>
        </div>

        {/* Status dropdown */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors cursor-pointer"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors [color-scheme:dark]"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-xl bg-[var(--admin-surface)] border border-[var(--admin-border)] px-3 py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-brand)] transition-colors [color-scheme:dark]"
          title="To date"
        />

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-xl bg-[var(--admin-brand)] px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Search
        </button>

        {/* Test toggle */}
        <button
          onClick={() => setShowTest(!showTest)}
          className="flex items-center gap-1.5 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] transition-colors ml-auto whitespace-nowrap"
        >
          {showTest ? <ToggleRight size={18} className="text-[var(--admin-brand)]" /> : <ToggleLeft size={18} />}
          <span data-cms-key="admin_bookings_show_test">Test</span>
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)] border border-[var(--admin-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--admin-border)]">
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider" data-cms-key="admin_bookings_col_code">
                Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider" data-cms-key="admin_bookings_col_user">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider" data-cms-key="admin_bookings_col_datetime">
                Date &amp; Time
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider" data-cms-key="admin_bookings_col_amount">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider" data-cms-key="admin_bookings_col_status">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--admin-text-muted)] uppercase tracking-wider w-[100px]">
                {/* Mark test column */}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {data.bookings.map((b) => {
              const displayCode = b.humanCode ?? b.bookingReference ?? b.id.slice(0, 8)
              const userDisplay = b.userName ?? b.userEmail ?? b.userPhone ?? 'Guest'
              const userSub = b.userName ? (b.userEmail ?? b.userPhone ?? '') : ''

              return (
                <tr
                  key={b.id}
                  onClick={() => onSelectBooking?.(b.id)}
                  className="group hover:bg-[var(--admin-brand)]/[0.04] transition-colors cursor-pointer"
                >
                  {/* Code */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-[var(--admin-text)] group-hover:text-[var(--admin-brand)] transition-colors">
                      {displayCode}
                    </span>
                    {b.isTest && (
                      <span className="ml-2 inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 leading-none">
                        TEST
                      </span>
                    )}
                  </td>

                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-[var(--admin-text)] truncate max-w-[200px]">{userDisplay}</div>
                    {userSub && (
                      <div className="text-xs text-[var(--admin-text-muted)] truncate max-w-[200px]">{userSub}</div>
                    )}
                  </td>

                  {/* Date + Time + Venue */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-[var(--admin-text)]">{formatDate(b.date)}</div>
                    <div className="text-xs text-[var(--admin-text-muted)]">
                      {formatTime(b.startTime, b.endTime)} · T{b.tableNumber}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono text-sm font-semibold text-[var(--admin-text)] tabular-nums">
                      ${b.price.toLocaleString('en-HK')}
                    </span>
                    <span className="text-xs text-[var(--admin-text-muted)] ml-0.5">HKD</span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {statusBadge(b.status)}
                  </td>

                  {/* Mark test */}
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={togglingId === b.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTest(b.id, !b.isTest)
                      }}
                      className="rounded-lg border border-[var(--admin-border)] px-2.5 py-1 text-xs text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] hover:border-[var(--admin-text-muted)] transition-colors disabled:opacity-40"
                    >
                      {togglingId === b.id ? '…' : b.isTest ? 'Unmark' : 'Test'}
                    </button>
                  </td>
                </tr>
              )
            })}

            {data.bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--admin-text-muted)]">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-[var(--admin-text-muted)]">
        <span>
          Page {page} of {totalPages} · {data.total.toLocaleString()} total
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => fetchPage(page - 1, status, search, dateFrom, dateTo, showTest)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] hover:border-[var(--admin-brand)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft size={14} />
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchPage(page + 1, status, search, dateFrom, dateTo, showTest)}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] hover:border-[var(--admin-brand)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
