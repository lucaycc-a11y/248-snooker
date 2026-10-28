'use client'

import { useCallback, useEffect, useState } from 'react'
import { PAYMENT_VERSION, PAYMENT_CHANGELOG } from '@/lib/payments/version'
import type { MonitorIssue, TimelineEntry } from '@/app/api/admin/payment-monitor/route'

type Bucket = { bookings: number; paidCount: number; paidAmount: number; pendingCount: number; failedCount: number; reviewCount: number }
type LiveRow = {
  attemptId: string; bookingId: string | null; humanCode: string | null; bookingStatus: string | null
  amount: number; providerOrderNo: string | null; status: string; ageMin: number
}
type EventRow = { id: string; created_at: string; human_code: string | null; event: string; source: string | null; from_state: string | null; to_state: string | null; reason: string | null }
type ErrorRow = { id: string; source: string | null; severity: string | null; message: string | null; created_at: string }
type Snapshot = {
  generatedAt: string
  eventsAvailable: boolean
  totals: { today: Bucket; last7d: Bucket }
  issues: MonitorIssue[]
  live: LiveRow[]
  events: EventRow[]
  errors: ErrorRow[]
  query: string | null
  timeline: TimelineEntry[] | null
  timelineHeader: string | null
}
type ReconcileItem = { attemptId: string; humanCode: string | null; providerOrderNo: string | null; ageMin: number; action: string; note?: string }

/** payment_events.event → plain Chinese; unknown values fall back to the raw name. */
const EVENT_LABEL: Record<string, string> = {
  confirmed: '預約已確認',
  webhook_paid_confirmed: 'KPay 通知已付款，預約確認',
  webhook_closed_or_failed: 'KPay 通知訂單關閉或失敗',
  reconcile_order_closed: '對賬：KPay 訂單已關閉',
  swept_expired: '逾時未付款，自動釋放',
  cancel_refused: '取消要求被拒絕',
  incident_parked: '已標記待人手處理',
}

const card = { background: 'var(--admin-bg-surface)', borderColor: 'var(--admin-border-subtle)' } as const
const muted = { color: 'var(--admin-text-tertiary)' } as const

const SEV: Record<string, { label: string; color: string }> = {
  critical: { label: '緊急', color: 'var(--admin-status-danger)' },
  warning: { label: '留意', color: 'var(--admin-status-warning)' },
  info: { label: '資訊', color: 'var(--admin-text-secondary)' },
}
const TONE: Record<string, string> = {
  ok: 'var(--admin-status-success)',
  warn: 'var(--admin-status-warning)',
  bad: 'var(--admin-status-danger)',
  neutral: 'var(--admin-text-tertiary)',
}
const STATE_TEXT: Record<string, string> = {
  paid: 'KPay：已付款', pending: 'KPay：仍可付款（未付）', closed: 'KPay：訂單已關閉', unknown: 'KPay：暫時查詢不到', none: '沒有 KPay 訂單',
}
const ACTION_TEXT: Record<string, string> = {
  expired_no_order: '沒有建立訂單，已結束',
  closed_marked_failed: 'KPay 已關閉，已標記失敗',
  paid_confirmed: 'KPay 已收款，已確認訂位',
  paid_confirm_failed: 'KPay 已收款，但確認失敗，需要處理',
  paid_needs_attention: 'KPay 已收款，需要處理',
  expired_old_pending: '超過 25 分鐘仍未付款，已結束',
  still_payable: '仍可付款，暫不處理',
  lookup_unknown: '查詢不到，稍後再試',
}

const hk = (iso: string) =>
  new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const money = (v: number) => `HK$${Math.round(v).toLocaleString('en-HK')}`

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-[var(--admin-radius-card)] border p-4" style={card}>
      <div className="text-xs" style={muted}>{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: tone ?? 'var(--admin-text-primary)' }}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs" style={muted}>{sub}</div> : null}
    </div>
  )
}

function Section({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-[var(--admin-radius-card)] border" style={card}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--admin-border-subtle)' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }}>{title}</h2>
          {hint ? <p className="text-xs" style={muted}>{hint}</p> : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}

function Btn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[36px] rounded-[var(--admin-radius-button)] border px-3 text-sm"
      style={{
        borderColor: primary ? 'var(--admin-green)' : 'var(--admin-border-subtle)',
        color: primary ? 'var(--admin-green)' : 'var(--admin-text-secondary)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function PaymentMonitorClient() {
  const [data, setData] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [includeTest, setIncludeTest] = useState(false)
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [checks, setChecks] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [recon, setRecon] = useState<ReconcileItem[] | null>(null)

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true)
      try {
        const params = new URLSearchParams()
        if (includeTest) params.set('test', '1')
        if (activeQuery) params.set('q', activeQuery)
        const res = await fetch(`/api/admin/payment-monitor?${params}`, { cache: 'no-store' })
        const json = (await res.json()) as Snapshot & { error?: string }
        if (!res.ok) throw new Error(json.error ?? '載入失敗')
        setData(json)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [includeTest, activeQuery],
  )

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(true), 30_000)
    return () => clearInterval(t)
  }, [load])

  async function checkOrder(orderNo: string) {
    setBusy(`check:${orderNo}`)
    try {
      const res = await fetch('/api/admin/payment-monitor/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', orderNo }),
      })
      const json = (await res.json()) as { state?: string; error?: string }
      setChecks((c) => ({ ...c, [orderNo]: json.state ? (STATE_TEXT[json.state] ?? json.state) : (json.error ?? '查詢失敗') }))
    } finally {
      setBusy(null)
    }
  }

  async function reconcile() {
    setBusy('reconcile')
    try {
      const res = await fetch('/api/admin/payment-monitor/action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile' }),
      })
      const json = (await res.json()) as { items?: ReconcileItem[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? '對賬失敗')
      setRecon(json.items ?? [])
      await load(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const criticalCount = data?.issues.filter((i) => i.severity === 'critical').length ?? 0
  const issueCount = data?.issues.length ?? 0

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mt-1 text-sm" style={muted}>即時讀取資料庫與 KPay，30 秒自動更新{data ? ` · 更新於 ${hk(data.generatedAt)}` : ''} · 付款系統 v{PAYMENT_VERSION}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
            <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} />
            包括測試訂單
          </label>
          <Btn onClick={() => void load()} disabled={loading}>重新整理</Btn>
          <Btn primary onClick={() => void reconcile()} disabled={busy === 'reconcile'}>
            {busy === 'reconcile' ? '對賬中…' : '自動對賬'}
          </Btn>
        </div>
      </header>

      {error ? (
        <div className="rounded-[var(--admin-radius-card)] border p-3 text-sm" style={{ borderColor: 'var(--admin-status-danger)', color: 'var(--admin-status-danger)' }}>{error}</div>
      ) : null}

      {data && !data.eventsAvailable ? (
        <div className="rounded-[var(--admin-radius-card)] border p-3 text-sm" style={{ borderColor: 'var(--admin-status-warning)', color: 'var(--admin-status-warning)' }}>
          付款事件記錄尚未啟用（資料庫缺少 payment_events），時間線只會顯示訂位、付款嘗試與 KPay 通知。
        </div>
      ) : null}

      {data ? (
        <div
          className="flex items-center gap-3 rounded-[var(--admin-radius-card)] border p-4"
          style={{ borderColor: criticalCount ? 'var(--admin-status-danger)' : issueCount ? 'var(--admin-status-warning)' : 'var(--admin-status-success)', background: card.background }}
        >
          <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: criticalCount ? 'var(--admin-status-danger)' : issueCount ? 'var(--admin-status-warning)' : 'var(--admin-status-success)' }} />
          <div className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>
            {issueCount === 0 ? '過去 48 小時沒有發現付款異常' : `有 ${issueCount} 項需要留意${criticalCount ? `，其中 ${criticalCount} 項緊急` : ''}`}
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="今日已收款" value={money(data.totals.today.paidAmount)} sub={`${data.totals.today.paidCount} 張已確認訂位`} />
          <Tile label="今日待付款" value={String(data.totals.today.pendingCount)} sub={`失敗／取消 ${data.totals.today.failedCount}`} />
          <Tile label="需要處理" value={String(data.totals.last7d.reviewCount)} sub="已收款待人手處理" tone={data.totals.last7d.reviewCount ? 'var(--admin-status-danger)' : undefined} />
          <Tile label="近 7 日已收款" value={money(data.totals.last7d.paidAmount)} sub={`${data.totals.last7d.paidCount} / ${data.totals.last7d.bookings} 張訂位`} />
        </div>
      ) : null}

      <Section title="查詢單一訂位" hint="輸入訂位編號（SPACE8-XXXXX-X）或 KPay 訂單編號，查看該訂位由建立至現在的完整記錄">
        <form
          className="flex flex-wrap gap-2 p-4"
          onSubmit={(e) => { e.preventDefault(); setActiveQuery(query.trim()) }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如 SPACE8-NQH9F-7 或 2026102619135900001"
            className="min-h-[40px] min-w-0 flex-1 rounded-[var(--admin-radius-input)] border bg-transparent px-3 text-sm"
            style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-primary)' }}
          />
          <Btn primary onClick={() => setActiveQuery(query.trim())}>查詢</Btn>
          {activeQuery ? <Btn onClick={() => { setQuery(''); setActiveQuery('') }}>清除</Btn> : null}
        </form>
        {data?.query ? (
          <div className="border-t p-4" style={{ borderColor: 'var(--admin-border-subtle)' }}>
            {data.timeline && data.timeline.length > 0 ? (
              <>
                {data.timelineHeader ? <p className="mb-3 text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{data.timelineHeader}</p> : null}
                <ol className="flex flex-col gap-3">
                  {data.timeline.map((t, i) => (
                    <li key={`${t.at}-${i}`} className="flex gap-3">
                      <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE[t.tone] }} />
                      <div className="min-w-0">
                        <div className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>{t.title}</div>
                        <div className="break-words text-xs" style={muted}>{hk(t.at)}{t.detail ? ` · ${t.detail}` : ''}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-sm" style={muted}>找不到「{data.query}」相關記錄</p>
            )}
          </div>
        ) : null}
      </Section>

      <Section
        title="需要處理"
        hint="過去 48 小時，按緊急程度排列"
        right={data ? <span className="text-xs" style={muted}>{issueCount} 項</span> : null}
      >
        {!data || data.issues.length === 0 ? (
          <p className="p-4 text-sm" style={muted}>{loading ? '載入中…' : '沒有需要處理的項目'}</p>
        ) : (
          <ul>
            {data.issues.map((i) => {
              const sev = SEV[i.severity]
              return (
                <li key={i.id} className="flex flex-wrap items-start gap-3 border-t p-4 first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-[var(--admin-radius-pill)] border px-2 py-0.5 text-xs" style={{ borderColor: sev.color, color: sev.color }}>{sev.label}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{i.title}</span>
                    </div>
                    <p className="mt-1 break-words text-sm" style={{ color: 'var(--admin-text-secondary)' }}>{i.detail}</p>
                    {i.at ? <p className="mt-0.5 text-xs" style={muted}>{hk(i.at)}</p> : null}
                    {i.providerOrderNo && checks[i.providerOrderNo] ? (
                      <p className="mt-1 text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{checks[i.providerOrderNo]}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {i.providerOrderNo ? (
                      <Btn onClick={() => void checkOrder(i.providerOrderNo as string)} disabled={busy === `check:${i.providerOrderNo}`}>查詢 KPay</Btn>
                    ) : null}
                    {i.humanCode ? <Btn onClick={() => { setQuery(i.humanCode as string); setActiveQuery(i.humanCode as string) }}>查看時間線</Btn> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {recon ? (
        <Section title="自動對賬結果" hint="已逐張向 KPay 查詢；已收款的訂位會自動確認，不會自動退款" right={<Btn onClick={() => setRecon(null)}>收起</Btn>}>
          {recon.length === 0 ? (
            <p className="p-4 text-sm" style={muted}>沒有需要對賬的付款嘗試</p>
          ) : (
            <ul>
              {recon.map((r) => (
                <li key={r.attemptId} className="border-t p-4 text-sm first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-secondary)' }}>
                  <span style={{ color: 'var(--admin-text-primary)' }}>{r.humanCode ?? r.attemptId.slice(0, 8)}</span> · {r.ageMin} 分鐘前 · {ACTION_TEXT[r.action] ?? r.action}
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title="進行中的付款" hint="仍然處於「已建立／等待付款」，超過 12 分鐘會被對賬處理" right={data ? <span className="text-xs" style={muted}>{data.live.length} 筆</span> : null}>
        {!data || data.live.length === 0 ? (
          <p className="p-4 text-sm" style={muted}>目前沒有進行中的付款</p>
        ) : (
          <ul>
            {data.live.map((l) => (
              <li key={l.attemptId} className="flex flex-wrap items-center gap-3 border-t p-4 text-sm first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                <div className="min-w-0 flex-1">
                  <div style={{ color: 'var(--admin-text-primary)' }}>{l.humanCode ?? '（無訂位）'} · {money(l.amount)}</div>
                  <div className="break-all text-xs" style={muted}>
                    訂位 {l.bookingStatus ?? '—'} · 付款 {l.status} · {l.ageMin} 分鐘前 · {l.providerOrderNo ?? '未建立 KPay 訂單'}
                  </div>
                  {l.providerOrderNo && checks[l.providerOrderNo] ? <div className="mt-1 text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>{checks[l.providerOrderNo]}</div> : null}
                </div>
                {l.providerOrderNo ? <Btn onClick={() => void checkOrder(l.providerOrderNo as string)} disabled={busy === `check:${l.providerOrderNo}`}>查詢 KPay</Btn> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-5 md:grid-cols-2">
        <Section title="最新付款事件" hint="系統每次付款決定都會記低">
          {!data || data.events.length === 0 ? (
            <p className="p-4 text-sm" style={muted}>暫時沒有記錄</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {data.events.map((e) => (
                <li key={e.id} className="border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                  <div className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>{EVENT_LABEL[e.event] ?? e.event}</div>
                  <div className="break-words text-xs" style={muted}>
                    {hk(e.created_at)} · {e.human_code ?? '—'}{e.source ? ` · ${e.source}` : ''}{e.from_state && e.to_state ? ` · ${e.from_state} → ${e.to_state}` : ''}{e.reason ? ` · ${e.reason}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="付款相關錯誤" hint="未標記已解決" right={<a className="text-xs underline" style={muted} href="/admin/errors">全部錯誤記錄</a>}>
          {!data || data.errors.length === 0 ? (
            <p className="p-4 text-sm" style={muted}>沒有未解決的付款錯誤</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {data.errors.map((e) => (
                <li key={e.id} className="border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)' }}>
                  <div className="break-words text-sm" style={{ color: 'var(--admin-text-primary)' }}>{e.message ?? '—'}</div>
                  <div className="text-xs" style={muted}>{hk(e.created_at)} · {e.source ?? ''}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title={`付款系統版本 v${PAYMENT_VERSION}`} hint="功能與修正記錄（由新到舊）">
        <div className="flex flex-col">
          {PAYMENT_CHANGELOG.map((c, i) => (
            <details key={c.version} open={i === 0} className="border-t px-4 py-3 first:border-t-0" style={{ borderColor: 'var(--admin-border-subtle)' }}>
              <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                v{c.version} · {c.date} · {c.title}
              </summary>
              <div className="mt-3 flex flex-col gap-3 text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                <div>
                  <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--admin-status-success)' }}>新功能</div>
                  <ul className="list-disc pl-5">{c.features.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold" style={{ color: 'var(--admin-status-warning)' }}>問題修正</div>
                  <ul className="list-disc pl-5">{c.fixes.map((f) => <li key={f}>{f}</li>)}</ul>
                </div>
              </div>
            </details>
          ))}
        </div>
      </Section>
    </div>
  )
}
