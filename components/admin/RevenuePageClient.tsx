'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  REVENUE_DEFINITIONS_NOTE,
  type PromoUsageRow,
  type RevenueBucket,
  type RevenueDetailRow,
  type RevenueTotals,
} from '@/lib/admin/revenue-definitions'
import type { AdminRevenueDailyRow, AdminRevenueReconciliation } from '@/lib/data/getAdminRevenue'

// 預約 → 「收入」. Every figure comes from /api/admin/revenue, which is the same
// loader the Excel export reads. Hidden accounts are excluded server-side; the
// toggle only asks the loader to include them. Nothing is re-filtered here.

type PresetId = 'today' | 'week' | 'month' | 'lastMonth' | 'custom'

type RevenuePayload = {
  totals: RevenueTotals
  daily: AdminRevenueDailyRow[]
  byMethod: RevenueBucket[]
  byTable: RevenueBucket[]
  byPeriod: RevenueBucket[]
  promos: PromoUsageRow[]
  detail: RevenueDetailRow[]
  detailTotal: number
  detailPage: number
  detailPageSize: number
  reconciliation: AdminRevenueReconciliation
  range: { from: string; to: string }
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: RevenuePayload }

const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部付款方式' },
  { value: 'card', label: '信用卡' },
  { value: 'alipay', label: 'Alipay HK' },
  { value: 'alipay_cn', label: '支付寶' },
  { value: 'google_pay', label: 'Google Pay' },
  { value: 'apple_pay', label: 'Apple Pay' },
  { value: 'wechat_pay', label: '微信支付' },
]

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: '今日' },
  { id: 'week', label: '本週' },
  { id: 'month', label: '本月' },
  { id: 'lastMonth', label: '上月' },
  { id: 'custom', label: '自訂' },
]

/** Hong Kong calendar day (UTC+8) as YYYY-MM-DD. */
function hkToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function hkMonthStart(offsetMonths = 0): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + offsetMonths
  const d = new Date(Date.UTC(y, m, 1))
  return d.toISOString().slice(0, 10)
}

function hkMonthEnd(offsetMonths = 0): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() + offsetMonths
  const d = new Date(Date.UTC(y, m + 1, 0))
  return d.toISOString().slice(0, 10)
}

function hkWeekStart(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const day = now.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1 // Monday-start week
  const d = new Date(now.getTime() - diff * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

function presetRange(id: PresetId): { from: string; to: string } {
  switch (id) {
    case 'today':
      return { from: hkToday(), to: hkToday() }
    case 'week':
      return { from: hkWeekStart(), to: hkToday() }
    case 'month':
      return { from: hkMonthStart(0), to: hkToday() }
    case 'lastMonth':
      return { from: hkMonthStart(-1), to: hkMonthEnd(-1) }
    case 'custom':
      return { from: hkMonthStart(0), to: hkToday() }
  }
}

function money(n: number): string {
  return `HK$${n.toLocaleString('en-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已確認',
  pending: '待付款',
  awaiting_payment: '待付款',
  cancelled: '已取消',
  admin_cancelled: '管理員取消',
  refunded: '已退款',
  partly_refunded: '部分退款',
  completed: '已完成',
  failed: '失敗',
  no_show: '未到場',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s
}

function Th({ children, cmsKey, right }: { children: ReactNode; cmsKey: string; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--admin-text-muted)' }}
      data-cms-key={cmsKey}
    >
      {children}
    </th>
  )
}

function Td({ children, right, mono }: { children: ReactNode; right?: boolean; mono?: boolean }) {
  return (
    <td
      className={`px-4 py-3 text-sm ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''}`}
      style={{ color: 'var(--admin-text-primary)' }}
    >
      {children}
    </td>
  )
}

function TableShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-x-auto rounded-2xl"
      style={{
        background: 'var(--admin-glass-bg)',
        border: '1px solid var(--admin-border)',
      }}
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function KpiTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'net' | 'refund' }) {
  const color =
    accent === 'net'
      ? 'var(--admin-success)'
      : accent === 'refund'
        ? 'var(--admin-warning)'
        : 'var(--admin-text-primary)'
  return (
    <div className="admin-card admin-stack" style={{ gap: 6 }}>
      <div className="admin-lbl" data-cms-key={`admin.revenue.kpi.${label}`}>
        {label}
      </div>
      <div className="admin-num" style={{ color, fontSize: 26, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint ? (
        <div className="admin-muted" style={{ fontSize: 12 }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function BucketTable({ title, rows, cmsPrefix }: { title: string; rows: RevenueBucket[]; cmsPrefix: string }) {
  return (
    <section className="admin-card admin-stack" style={{ gap: 12 }}>
      <h2 className="admin-ptitle" data-cms-key={`${cmsPrefix}.title`}>
        {title}
      </h2>
      {rows.length === 0 ? (
        <div className="admin-empty" data-cms-key={`${cmsPrefix}.empty`}>
          沒有資料
        </div>
      ) : (
        <TableShell>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <Th cmsKey={`${cmsPrefix}.col_name`}>項目</Th>
              <Th cmsKey={`${cmsPrefix}.col_count`} right>
                預約數
              </Th>
              <Th cmsKey={`${cmsPrefix}.col_revenue`} right>
                收入
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                <Td>{r.label}</Td>
                <Td right>{r.count}</Td>
                <Td right>{money(r.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </section>
  )
}

export default function RevenuePageClient() {
  const [preset, setPreset] = useState<PresetId>('month')
  const [from, setFrom] = useState(() => presetRange('month').from)
  const [to, setTo] = useState(() => presetRange('month').to)
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [includeTest, setIncludeTest] = useState(false)
  const [includeHidden, setIncludeHidden] = useState(false)
  const [detailPage, setDetailPage] = useState(1)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    const params = new URLSearchParams({
      from,
      to,
      paymentMethod,
      detailPage: String(detailPage),
    })
    if (includeTest) params.set('includeTest', 'true')
    if (includeHidden) params.set('includeHidden', 'true')
    try {
      const res = await fetch(`/api/admin/revenue?${params.toString()}`)
      const json = (await res.json()) as RevenuePayload & { error?: string }
      if (!res.ok || json.error) {
        setState({ kind: 'error', message: json.error ?? '收入資料載入失敗' })
        return
      }
      setState({ kind: 'ready', data: json })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : '收入資料載入失敗' })
    }
  }, [from, to, paymentMethod, includeTest, includeHidden, detailPage])

  useEffect(() => {
    void load()
  }, [load])

  function choosePreset(id: PresetId) {
    setPreset(id)
    if (id !== 'custom') {
      const r = presetRange(id)
      setFrom(r.from)
      setTo(r.to)
    }
    setDetailPage(1)
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ from, to, paymentMethod })
    if (includeTest) params.set('includeTest', 'true')
    if (includeHidden) params.set('includeHidden', 'true')
    return `/api/admin/revenue/export?${params.toString()}`
  }, [from, to, paymentMethod, includeTest, includeHidden])

  const chartData = useMemo(
    () =>
      state.kind === 'ready'
        ? state.data.daily.map((d) => ({
            day: d.date.slice(5),
            收入: d.revenue,
            退款: d.refund,
          }))
        : [],
    [state]
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--admin-text-primary)' }}
            data-cms-key="admin.revenue.title"
          >
            收入
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.revenue.subtitle">
            已確認預約的實收金額、退款與折扣拆解
          </p>
        </div>
        <a className="admin-btn" href={exportHref} data-cms-key="admin.revenue.export">
          匯出 Excel
        </a>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section className="admin-card admin-stack" style={{ gap: 12 }}>
        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="admin-seg" role="group" aria-label="日期範圍">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                onClick={() => choosePreset(p.id)}
                data-cms-key={`admin.revenue.preset.${p.id}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="admin-field">
            <span className="admin-lbl" data-cms-key="admin.revenue.from">
              開始日期
            </span>
            <input
              type="date"
              className="admin-input"
              value={from}
              onChange={(e) => {
                setPreset('custom')
                setFrom(e.target.value)
                setDetailPage(1)
              }}
            />
          </label>

          <label className="admin-field">
            <span className="admin-lbl" data-cms-key="admin.revenue.to">
              結束日期
            </span>
            <input
              type="date"
              className="admin-input"
              value={to}
              onChange={(e) => {
                setPreset('custom')
                setTo(e.target.value)
                setDetailPage(1)
              }}
            />
          </label>

          <label className="admin-field">
            <span className="admin-lbl" data-cms-key="admin.revenue.method">
              付款方式
            </span>
            <select
              className="admin-sel"
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value)
                setDetailPage(1)
              }}
            >
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 16 }}>
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => {
                setIncludeTest(e.target.checked)
                setDetailPage(1)
              }}
            />
            <span data-cms-key="admin.revenue.include_test">包括測試預約</span>
          </label>
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={includeHidden}
              onChange={(e) => {
                setIncludeHidden(e.target.checked)
                setDetailPage(1)
              }}
            />
            <span data-cms-key="admin.revenue.include_hidden">包括已隱藏帳戶</span>
          </label>
        </div>

        <p className="admin-note" style={{ whiteSpace: 'pre-line' }} data-cms-key="admin.revenue.definitions">
          {'計算方式：\n' + REVENUE_DEFINITIONS_NOTE}
        </p>
      </section>

      {/* ── Load state ──────────────────────────────────────────────────── */}
      {state.kind === 'loading' ? (
        <div className="admin-empty" role="status" data-cms-key="admin.revenue.loading">
          載入中…
        </div>
      ) : state.kind === 'error' ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-danger)' }}>
          <div className="admin-ptitle" style={{ color: 'var(--admin-danger)' }} data-cms-key="admin.revenue.error">
            收入資料載入失敗
          </div>
          <p className="admin-muted">{state.message}</p>
        </div>
      ) : (
        <>
          {/* ── KPI tiles ───────────────────────────────────────────────── */}
          <section className="admin-tiles">
            <KpiTile label="收入" value={money(state.data.totals.revenue)} hint={`已確認 ${state.data.totals.bookingCount} 單`} />
            <KpiTile label="預約數" value={String(state.data.totals.bookingCount)} />
            <KpiTile label="平均每單" value={money(state.data.totals.averagePerBooking)} />
            <KpiTile label="退款" value={money(state.data.totals.refund)} accent="refund" />
            <KpiTile label="優惠碼折扣" value={money(state.data.totals.promoDiscount)} />
            <KpiTile label="淨收入" value={money(state.data.totals.net)} hint="收入 − 退款" accent="net" />
          </section>

          {/* ── Daily chart ─────────────────────────────────────────────── */}
          <section className="admin-card admin-stack" style={{ gap: 12 }}>
            <h2 className="admin-ptitle" data-cms-key="admin.revenue.chart.title">
              每日收入
            </h2>
            <div className="admin-chart" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--admin-border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--admin-text-tertiary)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--admin-text-tertiary)', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--admin-bg-elevated)' }}
                    contentStyle={{
                      background: 'var(--admin-surface)',
                      border: '1px solid var(--admin-border)',
                      borderRadius: 12,
                      color: 'var(--admin-text-primary)',
                    }}
                    formatter={(value, name) => [money(Number(value ?? 0)), String(name ?? '')]}
                  />
                  <Bar dataKey="收入" fill="var(--admin-success)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="退款" fill="var(--admin-warning)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ── Breakdowns ──────────────────────────────────────────────── */}
          <div className="admin-grid2">
            <BucketTable title="按付款方式" rows={state.data.byMethod} cmsPrefix="admin.revenue.by_method" />
            <BucketTable title="按時段" rows={state.data.byPeriod} cmsPrefix="admin.revenue.by_period" />
          </div>

          <BucketTable title="按球桌" rows={state.data.byTable} cmsPrefix="admin.revenue.by_table" />

          {/* ── Promo usage ─────────────────────────────────────────────── */}
          <section className="admin-card admin-stack" style={{ gap: 12 }}>
            <h2 className="admin-ptitle" data-cms-key="admin.revenue.promos.title">
              優惠碼使用
            </h2>
            {state.data.promos.length === 0 ? (
              <div className="admin-empty" data-cms-key="admin.revenue.promos.empty">
                本期沒有優惠碼使用紀錄
              </div>
            ) : (
              <TableShell>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                    <Th cmsKey="admin.revenue.promos.col_code">優惠碼</Th>
                    <Th cmsKey="admin.revenue.promos.col_uses" right>
                      使用次數
                    </Th>
                    <Th cmsKey="admin.revenue.promos.col_discount" right>
                      折扣金額
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.promos.map((p) => (
                    <tr key={p.code} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                      <Td mono>{p.code}</Td>
                      <Td right>{p.uses}</Td>
                      <Td right>{money(p.totalDiscount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            )}
          </section>

          {/* ── Reconciliation ──────────────────────────────────────────── */}
          <section className="admin-card admin-stack" style={{ gap: 8 }}>
            <h2 className="admin-ptitle" data-cms-key="admin.revenue.recon.title">
              對帳
            </h2>
            <p className="admin-muted" data-cms-key="admin.revenue.recon.body">
              {`本期 payment_attempts ${state.data.reconciliation.attemptsInRange} 筆，已連結預約 ${state.data.reconciliation.linkedToBooking} 筆，未連結 ${state.data.reconciliation.orphaned} 筆。`}
            </p>
            <p className="admin-note" data-cms-key="admin.revenue.recon.note">
              {state.data.reconciliation.note}
            </p>
          </section>

          {/* ── Booking detail ──────────────────────────────────────────── */}
          <section className="admin-card admin-stack" style={{ gap: 12 }}>
            <div className="admin-toolbar" style={{ justifyContent: 'space-between' }}>
              <h2 className="admin-ptitle" data-cms-key="admin.revenue.detail.title">
                預約明細
              </h2>
              <span className="admin-muted" data-cms-key="admin.revenue.detail.count">
                {`共 ${state.data.detailTotal} 筆`}
              </span>
            </div>

            {state.data.detail.length === 0 ? (
              <div className="admin-empty" data-cms-key="admin.revenue.detail.empty">
                本期沒有預約
              </div>
            ) : (
              <div className="admin-scroll">
                <TableShell>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--admin-border)' }}>
                      <Th cmsKey="admin.revenue.detail.col_date">日期</Th>
                      <Th cmsKey="admin.revenue.detail.col_time">時間</Th>
                      <Th cmsKey="admin.revenue.detail.col_table" right>
                        球桌
                      </Th>
                      <Th cmsKey="admin.revenue.detail.col_member">會員</Th>
                      <Th cmsKey="admin.revenue.detail.col_status">狀態</Th>
                      <Th cmsKey="admin.revenue.detail.col_method">付款</Th>
                      <Th cmsKey="admin.revenue.detail.col_amount" right>
                        金額
                      </Th>
                      <Th cmsKey="admin.revenue.detail.col_promo">優惠碼</Th>
                      <Th cmsKey="admin.revenue.detail.col_refund" right>
                        退款
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.detail.map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--admin-border-subtle)' }}>
                        <Td mono>{r.date}</Td>
                        <Td mono>{r.startTime}</Td>
                        <Td right>{r.tableNumber ?? '—'}</Td>
                        <Td>
                          {r.memberName ?? r.memberCode ?? r.memberPhone ?? '—'}
                          {r.isTest ? (
                            <span className="admin-tag warn" data-cms-key="admin.revenue.detail.test">
                              測試
                            </span>
                          ) : null}
                          {r.isHiddenUser ? (
                            <span className="admin-tag warn" data-cms-key="admin.revenue.detail.hidden">
                              已隱藏
                            </span>
                          ) : null}
                        </Td>
                        <Td>{statusLabel(r.status)}</Td>
                        <Td>{r.paymentMethod ?? '—'}</Td>
                        <Td right>{money(r.amount)}</Td>
                        <Td mono>{r.promoCode ?? '—'}</Td>
                        <Td right>{r.refundAmount > 0 ? money(r.refundAmount) : '—'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              </div>
            )}

            {state.data.detailTotal > state.data.detailPageSize ? (
              <nav className="admin-pager" aria-label="預約明細分頁">
                <button
                  type="button"
                  className="admin-btn"
                  disabled={detailPage <= 1}
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  data-cms-key="admin.revenue.detail.prev"
                >
                  上一頁
                </button>
                <span className="admin-muted">
                  {`${detailPage} / ${Math.max(1, Math.ceil(state.data.detailTotal / state.data.detailPageSize))}`}
                </span>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={detailPage * state.data.detailPageSize >= state.data.detailTotal}
                  onClick={() => setDetailPage((p) => p + 1)}
                  data-cms-key="admin.revenue.detail.next"
                >
                  下一頁
                </button>
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
