'use client'

/**
 * Admin Audit Log — §10.3.
 *
 * Paginated table of admin_action_log entries.
 * Columns: timestamp | admin email | action | target | details
 * Features: filters (admin email, action type, date range), CSV export.
 * Passwords always "[REDACTED]" — redaction happens server-side.
 *
 * Design system: admin-theme.css variables only.
 * NO inline hex, NO shadows, NO `any`.
 */

import { useState, useEffect, useCallback } from 'react'

/* ── Types ────────────────────────────────────────────── */
type AuditRow = {
  id: string
  adminId: string
  adminEmail: string
  actionType: string
  targetTable: string | null
  targetId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  riskLevel: string | null
  createdAt: string
}

type AuditResponse = {
  rows: AuditRow[]
  total: number
  page: number
  pageSize: number
}

/* ── Action type labels ─────────────────────────────── */
const ACTION_LABELS: Record<string, string> = {
  member_adjust_points: 'Adjust Points',
  member_set_tier: 'Set Tier',
  member_blacklist: 'Blacklist',
  member_unblacklist: 'Unblacklist',
  booking_cancel: 'Cancel Booking',
  booking_confirm: 'Confirm Booking',
  coupon_create: 'Create Coupon',
  coupon_update: 'Update Coupon',
  user_update: 'Update User',
  ai_propose: 'AI Proposal',
  ai_confirm: 'AI Confirm',
}

function formatActionType(raw: string): string {
  return ACTION_LABELS[raw] ?? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── Risk badge colours ────────────────────────────── */
const RISK_COLOR: Record<string, { color: string; bg: string }> = {
  low: { color: 'var(--admin-brand)', bg: 'var(--admin-brand-dim)' },
  medium: { color: 'var(--admin-warning)', bg: 'var(--admin-warning-dim)' },
  high: { color: 'var(--admin-danger)', bg: 'var(--admin-danger-dim)' },
}

/* ── Main component ─────────────────────────────────── */
export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filters
  const [adminEmail, setAdminEmail] = useState('')
  const [actionType, setActionType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const pageSize = 50
  const totalPages = Math.ceil(total / pageSize)

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (adminEmail) params.set('admin_email', adminEmail)
    if (actionType) params.set('action_type', actionType)
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)

    try {
      const res = await fetch(`/api/admin/audit?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: AuditResponse = await res.json()
      setRows(data.rows)
      setTotal(data.total)
    } catch (err) {
      console.error('[audit] fetch error', err)
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [adminEmail, actionType, dateFrom, dateTo])

  // Fetch on mount and filter change
  useEffect(() => {
    setPage(1)
    fetchLogs(1)
  }, [fetchLogs])

  const handleSearch = () => {
    setPage(1)
    fetchLogs(1)
  }

  const handleExportCSV = () => {
    if (rows.length === 0) return

    const headers = ['Timestamp', 'Admin Email', 'Action', 'Target Table', 'Target ID', 'Risk Level', 'Before', 'After']
    const csvRows = rows.map((r) => [
      r.createdAt,
      r.adminEmail,
      formatActionType(r.actionType),
      r.targetTable ?? '',
      r.targetId ?? '',
      r.riskLevel ?? '',
      JSON.stringify(r.before ?? {}),
      JSON.stringify(r.after ?? {}),
    ])

    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const uniqueActions = [...new Set(rows.map((r) => r.actionType))].sort()

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
        >
          Audit Log
        </h1>
        <button
          type="button"
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            color: 'var(--admin-brand-text)',
            background: 'var(--admin-brand)',
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </header>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-2xl p-4"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
            Admin Email
          </label>
          <input
            type="text"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="Filter by email..."
            className="rounded-lg border px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
            style={{
              background: 'var(--admin-bg)',
              color: 'var(--admin-text)',
              borderColor: 'var(--admin-border)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
            Action Type
          </label>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
            style={{
              background: 'var(--admin-bg)',
              color: 'var(--admin-text)',
              borderColor: 'var(--admin-border)',
            }}
          >
            <option value="">All actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{formatActionType(a)}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
            style={{
              background: 'var(--admin-bg)',
              color: 'var(--admin-text)',
              borderColor: 'var(--admin-border)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
            style={{
              background: 'var(--admin-bg)',
              color: 'var(--admin-text)',
              borderColor: 'var(--admin-border)',
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            color: 'var(--admin-brand-text)',
            background: 'var(--admin-brand)',
          }}
        >
          Search
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div
        className="overflow-x-auto rounded-2xl"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
      >
        <table className="w-full text-left text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Timestamp</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Admin</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Action</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Target</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Risk</th>
              <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--admin-text-muted)' }}>
                  <span className="admin-conic-spinner mx-auto" />
                  <span className="ml-2">Loading…</span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center" style={{ color: 'var(--admin-text-muted)' }}>
                  No audit entries found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--admin-border)' }}
                >
                  {/* Timestamp */}
                  <td className="whitespace-nowrap px-4 py-2.5" style={{ color: 'var(--admin-text-muted)' }}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>

                  {/* Admin */}
                  <td className="max-w-[200px] truncate px-4 py-2.5 font-medium" style={{ color: 'var(--admin-text)' }}>
                    {row.adminEmail}
                  </td>

                  {/* Action */}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        color: 'var(--admin-brand)',
                        background: 'var(--admin-brand-dim)',
                      }}
                    >
                      {formatActionType(row.actionType)}
                    </span>
                  </td>

                  {/* Target */}
                  <td className="whitespace-nowrap px-4 py-2.5" style={{ color: 'var(--admin-text-muted)' }}>
                    {row.targetTable && <span>{row.targetTable}</span>}
                    {row.targetId && (
                      <span
                        className="ml-1 font-[var(--font-mono,monospace)] text-[10px]"
                        style={{ color: 'var(--admin-text-faint)' }}
                      >
                        {row.targetId.slice(0, 8)}…
                      </span>
                    )}
                  </td>

                  {/* Risk */}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {row.riskLevel && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          color: RISK_COLOR[row.riskLevel]?.color ?? 'var(--admin-text-muted)',
                          background: RISK_COLOR[row.riskLevel]?.bg ?? 'var(--admin-surface-elevated)',
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: RISK_COLOR[row.riskLevel]?.color ?? 'var(--admin-text-muted)' }}
                        />
                        {row.riskLevel}
                      </span>
                    )}
                  </td>

                  {/* Details (collapsed JSON) */}
                  <td className="max-w-[300px] px-4 py-2.5">
                    {row.after && (
                      <pre
                        className="max-h-16 overflow-auto text-[10px] leading-tight"
                        style={{
                          color: 'var(--admin-text-faint)',
                          fontFamily: 'var(--font-mono, monospace)',
                        }}
                      >
                        {JSON.stringify(row.after, null, 0)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          <span>
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchLogs(Math.max(1, page - 1)) }}
              disabled={page === 1}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'var(--admin-surface-elevated)',
                color: page === 1 ? 'var(--admin-text-faint)' : 'var(--admin-text)',
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              Previous
            </button>
            <span style={{ color: 'var(--admin-text)' }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); fetchLogs(Math.min(totalPages, page + 1)) }}
              disabled={page === totalPages}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: 'var(--admin-surface-elevated)',
                color: page === totalPages ? 'var(--admin-text-faint)' : 'var(--admin-text)',
                opacity: page === totalPages ? 0.5 : 1,
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
