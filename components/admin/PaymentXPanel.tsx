'use client'

import { useCallback, useEffect, useState } from 'react'

// 後台 → 設定 → PaymentX (KPay 全托管收銀台). Pick which accounts can use it, watch the
// latest orders and the raw KPay notify payloads. Admin theme variables only.

type Tester = {
  userId: string
  email: string | null
  displayName: string | null
  memberCode: string | null
  note: string | null
  addedBy: string | null
  createdAt: string | null
}
type OrderRow = {
  id: string
  bookingId: string
  bookingStatus: string | null
  code: string | null
  managedOrderNo: string | null
  amount: number
  status: string
  paidOrderNo: string | null
  failureReason: string | null
  isTest: boolean
  createdAt: string | null
}
type EventRow = { id: number; created_at: string; kind: string; note: string | null; managed_order_no: string | null; payload: unknown }
type Changelog = { version: string; date: string; title: string; changes: string[] }

type Loaded = { version: string; changelog: Changelog[]; testers: Tester[]; orders: OrderRow[]; events: EventRow[] }

const STATUS_TEXT: Record<string, string> = {
  creating: '建立中',
  pending: '等待付款',
  paid: '已付款',
  needs_review: '需人手覆核',
  closed: '已關閉',
  expired: '已過期',
  failed: '建單失敗',
  cancelled: '已取消',
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function hk(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.toISOString().slice(11, 19)}`
}

const card = { borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' } as const
const muted = { color: 'var(--admin-text-tertiary)' } as const
const primary = { color: 'var(--admin-text-primary)' } as const

export default function PaymentXPanel() {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/paymentx', { cache: 'no-store' })
      const json: unknown = await res.json()
      if (!res.ok || !isRecord(json)) {
        setError(isRecord(json) && typeof json.error === 'string' ? json.error : '載入失敗')
        return
      }
      setError(null)
      setData(json as unknown as Loaded)
    } catch {
      setError('載入失敗')
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 20_000)
    return () => clearInterval(t)
  }, [load])

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch('/api/admin/paymentx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok || !isRecord(json)) {
      setError(isRecord(json) && typeof json.error === 'string' ? json.error : '操作失敗')
      return null
    }
    setError(null)
    return json
  }

  async function sync(orderId: string) {
    setBusy(orderId)
    setMessage(null)
    try {
      const json = await post({ action: 'sync', orderId })
      if (json) setMessage(`同步結果：${String(json.outcome)}`)
      await load()
    } finally {
      setBusy(null)
    }
  }

  const label = (t: { displayName: string | null; email: string | null; memberCode: string | null }) =>
    [t.displayName, t.email, t.memberCode].filter(Boolean).join(' · ') || '(未命名)'

  return (
    <section className="overflow-hidden rounded-[var(--admin-radius-card)] border" style={card}>
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--admin-border-subtle)' }}>
        <h2 className="text-base font-semibold" style={primary}>
          PaymentX
        </h2>
        <span
          className="rounded-[var(--admin-radius-pill)] border px-2.5 py-0.5 text-xs font-medium"
          style={{ borderColor: 'var(--admin-green)', color: 'var(--admin-green)' }}
        >
          v{data?.version ?? 'X1.0.0'}
        </span>
        <span className="text-xs" style={muted}>
          KPay 全托管收銀台 · 測試中
        </span>
      </div>

      <p className="px-5 pt-4 text-xs" style={muted}>
        邊啲帳戶／係咪全部客人用 PaymentX，喺上面「支付系統」設定。呢度只睇 PaymentX 訂單同 KPay 通知記錄。
      </p>
      {error && (
        <p className="px-5 pt-3 text-sm" style={{ color: 'var(--admin-status-danger)' }}>
          {error}
        </p>
      )}

      {/* ── Orders ─────────────────────────────── */}
      <div className="px-5 pb-1 pt-6">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium" style={primary}>
            最近 PaymentX 訂單
          </h3>
          {message && (
            <span className="text-xs" style={muted}>
              {message}
            </span>
          )}
        </div>
        {data && data.orders.length === 0 && (
          <p className="mt-2 text-xs" style={muted}>
            未有訂單。
          </p>
        )}
        <ul className="mt-2 flex flex-col">
          {data?.orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={primary}>
                  {o.code ?? '-'} · HK${o.amount}
                  {o.isTest && <span style={muted}> · 測試</span>}
                </p>
                <p className="mt-0.5 break-all text-xs" style={muted}>
                  {STATUS_TEXT[o.status] ?? o.status}
                  {o.bookingStatus ? ` · 預約 ${o.bookingStatus}` : ''} · {hk(o.createdAt)}
                  {o.managedOrderNo ? ` · 全托管單 …${o.managedOrderNo.slice(-8)}` : ''}
                  {o.paidOrderNo ? ` · 交易單 ${o.paidOrderNo}` : ''}
                  {o.failureReason ? ` · ${o.failureReason}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => void sync(o.id)}
                className="rounded-[var(--admin-radius-pill)] border px-3 py-1 text-xs"
                style={{ borderColor: 'var(--admin-border-subtle)', ...primary, opacity: busy === o.id ? 0.5 : 1 }}
              >
                向 KPay 同步
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ── KPay notify log + changelog ─────────── */}
      <div className="px-5 pb-5 pt-4">
        <button type="button" onClick={() => setShowLog((v) => !v)} className="text-xs underline" style={muted}>
          {showLog ? '收起' : '展開'} KPay 通知紀錄與版本更新
        </button>
        {showLog && (
          <div className="mt-3 flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {(data?.events ?? []).length === 0 && (
                <li className="text-xs" style={muted}>
                  未有通知紀錄。
                </li>
              )}
              {data?.events.map((ev) => (
                <li key={ev.id} className="rounded-[var(--admin-radius-card)] border p-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                  <p className="text-xs" style={primary}>
                    {hk(ev.created_at)} · {ev.kind}
                    {ev.note ? ` · ${ev.note}` : ''}
                  </p>
                  {ev.payload !== null && ev.payload !== undefined && (
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px]" style={muted}>
                      {JSON.stringify(ev.payload, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
            {data?.changelog.map((c) => (
              <div key={c.version}>
                <p className="text-sm font-medium" style={primary}>
                  v{c.version} · {c.date}
                </p>
                <p className="mt-0.5 text-xs" style={muted}>
                  {c.title}
                </p>
                <ul className="mt-1 list-disc pl-5 text-xs" style={muted}>
                  {c.changes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
