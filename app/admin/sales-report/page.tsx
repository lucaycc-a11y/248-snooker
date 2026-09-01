'use client'

/**
 * Admin Sales Report — §11.2.
 *
 * Date range picker → Recharts bar/line charts for revenue, bookings, and AOV.
 * Natural-language Q&A widget at the bottom (read-only AI call).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'

/* ── Types ────────────────────────────────────────────── */
type DailyRow = {
  date: string
  revenue: number
  bookings: number
  avgOrderValue: number
  method_breakdown?: Record<string, number>
}

type Summary = {
  totalRevenue: number
  totalBookings: number
  avgOrderValue: number
  paidCount: number
  pendingCount: number
  failedCount: number
}

type ReportResponse = {
  rows: DailyRow[]
  summary: Summary
}

type QAResponse = {
  answer: string
  source: 'ai' | 'none'
}

/* ── Tier display mapping ─────────────────────────────── */
const METHOD_COLORS: Record<string, string> = {
  kpay: '#22c55e',
  stripe: '#16a34a',
  payme: '#15803d',
  cash: '#166534',
  points: '#4ade80',
  free: '#86efac',
  other: '#bbf7d0',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/* ── Main component ─────────────────────────────────── */
export default function SalesReportPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ReportResponse | null>(null)

  const [question, setQuestion] = useState('')
  const [qaAnswer, setQaAnswer] = useState<string | null>(null)
  const [qaLoading, setQaLoading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo })
      const res = await fetch(`/api/admin/sales-report?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: unknown = await res.json()
      if (isRecord(json) && Array.isArray(json.rows) && isRecord(json.summary)) {
        setData(json as unknown as ReportResponse)
      }
    } catch (err) {
      console.error('[sales-report] fetch error', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  // Auto-fetch on mount
  useEffect(() => { fetchReport() }, [fetchReport])

  const handleAsk = useCallback(async () => {
    const q = question.trim()
    if (!q) return
    setQaLoading(true)
    setQaAnswer(null)
    try {
      const res = await fetch('/api/admin/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, context: 'sales_report' }),
      })
      const json: unknown = await res.json()
      if (isRecord(json) && typeof json.content === 'string') {
        setQaAnswer(json.content)
      } else {
        setQaAnswer('No answer available.')
      }
    } catch {
      setQaAnswer('Failed to get answer. Please try again.')
    } finally {
      setQaLoading(false)
    }
  }, [question])

  const chartData = useMemo(() => {
    if (!data) return []
    return data.rows.map((r) => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' }),
    }))
  }, [data])

  const methodPieData = useMemo(() => {
    if (!data) return []
    const totals: Record<string, number> = {}
    for (const row of data.rows) {
      if (row.method_breakdown) {
        for (const [method, count] of Object.entries(row.method_breakdown)) {
          totals[method] = (totals[method] ?? 0) + count
        }
      }
    }
    return Object.entries(totals).map(([name, value]) => ({ name, value }))
  }, [data])

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin_sales_report_title"
        >
          Sales Report
        </h1>
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
            From
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
            To
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
          onClick={fetchReport}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            color: 'var(--admin-brand-text)',
            background: 'var(--admin-brand)',
          }}
        >
          {loading ? <span className="admin-conic-spinner h-3.5 w-3.5" /> : 'Apply'}
        </button>
      </div>

      {/* ── Summary Cards ──────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'Total Revenue', value: `HK$${data.summary.totalRevenue.toLocaleString()}` },
            { label: 'Total Bookings', value: data.summary.totalBookings.toLocaleString() },
            { label: 'Avg. Order Value', value: `HK$${data.summary.avgOrderValue.toLocaleString()}` },
            { label: 'Paid', value: data.summary.paidCount.toLocaleString(), color: 'var(--admin-brand)' },
            { label: 'Pending', value: data.summary.pendingCount.toLocaleString(), color: 'var(--admin-warning)' },
          ].map((card) => (
            <div
              key={card.label}
              className="flex flex-col gap-1 rounded-2xl p-4"
              style={{
                background: 'var(--admin-surface)',
                border: '1px solid var(--admin-border)',
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                {card.label}
              </span>
              <span className="text-xl font-bold" style={{ color: card.color ?? 'var(--admin-text)' }}>
                {card.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ─────────────────────────────────────────── */}
      {data && chartData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Bar chart — Revenue by day */}
          <div
            className="col-span-2 rounded-2xl p-4"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
              Daily Revenue (HKD)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--admin-text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--admin-text-muted)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--admin-surface-elevated)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--admin-text)' }}
                />
                <Bar dataKey="revenue" fill="var(--admin-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart — Payment methods */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
              Payment Methods
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={methodPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                >
                  {methodPieData.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={METHOD_COLORS[entry.name] ?? 'var(--admin-text-muted)'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--admin-surface-elevated)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10 }}
                  formatter={(value: string) => <span style={{ color: 'var(--admin-text-muted)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Line chart — Bookings over time ────────────────── */}
      {data && chartData.length > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'var(--admin-surface)',
            border: '1px solid var(--admin-border)',
          }}
        >
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
            Daily Bookings & AOV
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--admin-text-muted)' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--admin-text-muted)' }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--admin-text-muted)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--admin-surface-elevated)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value: string) => <span style={{ color: 'var(--admin-text-muted)' }}>{value}</span>}
              />
              <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="var(--admin-brand)" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="avgOrderValue" stroke="var(--admin-warning)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Q&A Widget ─────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
        }}
      >
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
          Ask about your sales data
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAsk() }}
            placeholder="e.g. What was the busiest day last month?"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--admin-brand)]"
            style={{
              background: 'var(--admin-bg)',
              color: 'var(--admin-text)',
              borderColor: 'var(--admin-border)',
            }}
            data-cms-key="admin_sales_report_qa_placeholder"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={qaLoading || !question.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              color: 'var(--admin-brand-text)',
              background: 'var(--admin-brand)',
              opacity: qaLoading || !question.trim() ? 0.5 : 1,
            }}
          >
            {qaLoading ? <span className="admin-conic-spinner h-4 w-4" /> : 'Ask'}
          </button>
        </div>
        {qaAnswer && (
          <div
            className="mt-3 rounded-xl p-3 text-sm leading-relaxed"
            style={{
              color: 'var(--admin-text)',
              background: 'var(--admin-surface-elevated)',
            }}
          >
            {qaAnswer}
          </div>
        )}
      </div>

      {/* ── Daily table ────────────────────────────────────── */}
      {data && (
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
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Date</th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Revenue</th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Bookings</th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>AOV</th>
                <th className="px-4 py-3 font-semibold" style={{ color: 'var(--admin-text-muted)' }}>Methods</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr
                  key={row.date}
                  style={{ borderBottom: '1px solid var(--admin-border)' }}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium" style={{ color: 'var(--admin-text)' }}>
                    {new Date(row.date).toLocaleDateString('en-HK')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5" style={{ color: 'var(--admin-brand)' }}>
                    HK${row.revenue.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--admin-text-muted)' }}>
                    {row.bookings}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--admin-text-muted)' }}>
                    HK${row.avgOrderValue.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.method_breakdown && Object.entries(row.method_breakdown).map(([method, count]) => (
                      <span
                        key={method}
                        className="mr-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase"
                        style={{
                          color: METHOD_COLORS[method] ?? 'var(--admin-text-muted)',
                          background: 'var(--admin-surface-elevated)',
                        }}
                      >
                        {method} ×{count}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Empty / Loading ────────────────────────────────── */}
      {loading && !data && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--admin-text-muted)' }}>
          <span className="admin-conic-spinner mr-2" />
          Loading report…
        </div>
      )}
      {!loading && !data && (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--admin-text-muted)' }}>
          No data available for the selected range.
        </div>
      )}
    </main>
  )
}
