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
        setQaAnswer('暫時沒有答案')
      }
    } catch {
      setQaAnswer('查詢失敗，請再試一次')
    } finally {
      setQaLoading(false)
    }
  }, [question])

  const chartData = useMemo(() => {
    if (!data) return []
    return data.rows.map((r) => ({
      ...r,
      date: new Date(r.date).toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric' }),
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

  const tick = { fontSize: 13, fill: 'var(--admin-text-tertiary)' }
  const tip = {
    contentStyle: { background: 'var(--admin-bg-elevated)', border: '1px solid var(--admin-border-subtle)', borderRadius: 14, fontSize: 14 },
    labelStyle: { color: 'var(--admin-text-primary)' },
  }
  const setRange = (days: number) => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - (days - 1))
    setDateFrom(from.toISOString().slice(0, 10))
    setDateTo(to.toISOString().slice(0, 10))
  }

  const kpis = data
    ? [
        { label: '總收入', value: `HK$${data.summary.totalRevenue.toLocaleString()}`, tone: 'var(--admin-green)' },
        { label: '預約總數', value: data.summary.totalBookings.toLocaleString() },
        { label: '平均訂單金額', value: `HK$${data.summary.avgOrderValue.toLocaleString()}` },
        { label: '已付款', value: data.summary.paidCount.toLocaleString() },
        { label: '待付款', value: data.summary.pendingCount.toLocaleString(), tone: data.summary.pendingCount ? 'var(--admin-status-warning)' : undefined },
      ]
    : []

  return (
    <div className="admin-stack">
      <section className="admin-card">
        <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); void fetchReport() }}>
          <label className="ad-field">
            <span>開始日期</span>
            <input className="ad-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="ad-field">
            <span>結束日期</span>
            <input className="ad-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button type="button" className="ad-btn" onClick={() => setRange(7)}>近 7 日</button>
          <button type="button" className="ad-btn" onClick={() => setRange(30)}>近 30 日</button>
          <button type="submit" className="ad-btn ad-btn-primary" disabled={loading}>{loading ? '載入中…' : '套用'}</button>
        </form>
      </section>

      {data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className="admin-card" style={{ padding: 16 }}>
              <div className="ad-muted">{k.label}</div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 700, color: k.tone ?? 'var(--admin-text-primary)' }}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {data && chartData.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="admin-card lg:col-span-2">
            <div className="admin-head"><h3>每日收入（HK$）</h3></div>
            <div style={{ padding: '0 12px 16px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border-subtle)" />
                  <XAxis dataKey="date" tick={tick} />
                  <YAxis tick={tick} />
                  <Tooltip {...tip} />
                  <Bar dataKey="revenue" name="收入" fill="var(--admin-green)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-head"><h3>付款方式</h3></div>
            <div style={{ padding: '0 12px 16px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={methodPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" nameKey="name">
                    {methodPieData.map((entry) => (
                      <Cell key={entry.name} fill={METHOD_COLORS[entry.name] ?? 'var(--admin-text-tertiary)'} />
                    ))}
                  </Pie>
                  <Tooltip {...tip} />
                  <Legend wrapperStyle={{ fontSize: 13 }} formatter={(value: string) => <span style={{ color: 'var(--admin-text-secondary)' }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      ) : null}

      {data && chartData.length > 0 ? (
        <section className="admin-card">
          <div className="admin-head"><h3>每日預約數與平均訂單金額</h3></div>
          <div style={{ padding: '0 12px 16px' }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--admin-border-subtle)" />
                <XAxis dataKey="date" tick={tick} />
                <YAxis yAxisId="left" tick={tick} />
                <YAxis yAxisId="right" orientation="right" tick={tick} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 13 }} formatter={(value: string) => <span style={{ color: 'var(--admin-text-secondary)' }}>{value}</span>} />
                <Line yAxisId="left" type="monotone" dataKey="bookings" name="預約數" stroke="var(--admin-green)" strokeWidth={2.5} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="avgOrderValue" name="平均訂單金額" stroke="var(--admin-status-warning)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="admin-card">
        <div className="admin-head"><h3>向 AI 查詢銷售數據</h3></div>
        <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); void handleAsk() }}>
          <label className="ad-field" style={{ flex: '3 1 260px' }}>
            <span>問題</span>
            <input
              className="ad-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="例如：上個月邊日最旺？"
              data-cms-key="admin_sales_report_qa_placeholder"
            />
          </label>
          <button type="submit" className="ad-btn ad-btn-primary" disabled={qaLoading || !question.trim()}>{qaLoading ? '查詢中…' : '查詢'}</button>
        </form>
        {qaAnswer ? (
          <p style={{ margin: '0 20px 18px', padding: '12px 14px', borderRadius: 14, background: 'var(--admin-bg-tile)', fontSize: 15, lineHeight: 1.6 }}>{qaAnswer}</p>
        ) : null}
      </section>

      {data ? (
        <section className="admin-card">
          <div className="admin-head"><h3>每日明細</h3></div>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr><th>日期</th><th>收入</th><th>預約數</th><th>平均訂單金額</th><th>付款方式</th></tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.date}>
                    <td data-label="日期" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(row.date).toLocaleDateString('zh-HK')}</td>
                    <td data-label="收入" style={{ color: 'var(--admin-green)', whiteSpace: 'nowrap' }}>HK${row.revenue.toLocaleString()}</td>
                    <td data-label="預約數">{row.bookings}</td>
                    <td data-label="平均訂單金額">HK${row.avgOrderValue.toLocaleString()}</td>
                    <td data-label="付款方式" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {row.method_breakdown
                        ? Object.entries(row.method_breakdown).map(([method, count]) => (
                            <span key={method} className="ad-chip" data-tone="muted">{method} ×{count}</span>
                          ))
                        : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {loading && !data ? <p className="ad-empty">載入報表中…</p> : null}
      {!loading && !data ? <p className="ad-empty">所選日期範圍沒有資料</p> : null}
    </div>
  )
}
