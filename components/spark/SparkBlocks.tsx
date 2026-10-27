'use client'

/**
 * Rich cards Spark shows inside a chat: income, member overview, and the confirm card that
 * guards every database change (confirm / reject / undo / redo).
 */

import { useState } from 'react'
import { AlertTriangle, Check, CircleSlash, Clock, RotateCcw, RotateCw, ShieldCheck, X } from 'lucide-react'
import CountUp from '@/components/admin/CountUp'
import type { ActionBlock, IncomeBlock, MemberStatsBlock, SparkBlock } from '@/lib/spark/agent'
import type { SparkActionView } from '@/lib/spark/actions'

const hkd = (n: number): string => `HK$${Math.round(n).toLocaleString('en-HK')}`
const md = (iso: string): string => `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日`
const TIER_LABEL: Record<string, string> = { amateur: '業餘', century: '百分', maximum: '滿分' }

function clock(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── Income ───────────────────────────────────────────────────────────────────────────────────
export function IncomeCard({ b }: { b: IncomeBlock }) {
  const max = Math.max(1, ...b.daily.map((d) => d.revenue))
  const days = b.daily.length
  const bars = b.daily.slice(-62)
  return (
    <section className="sp-card" aria-label="收入">
      <header className="sp-card-head">
        <span className="sp-card-kicker">收入</span>
        <span className="sp-card-range">{b.from === b.to ? md(b.from) : `${md(b.from)} – ${md(b.to)}`}</span>
      </header>
      <div className="sp-income-main">
        <b className="sp-big admin-num">
          <CountUp text={hkd(b.revenue)} />
        </b>
        <dl className="sp-kv">
          <div><dt>預約</dt><dd className="admin-num">{b.bookings} 張</dd></div>
          <div><dt>平均每張</dt><dd className="admin-num">{hkd(b.average)}</dd></div>
          <div><dt>退款</dt><dd className="admin-num">{b.refund > 0 ? `−${hkd(b.refund)}` : '—'}</dd></div>
          <div><dt>淨收入</dt><dd className="admin-num">{hkd(b.net)}</dd></div>
        </dl>
      </div>
      {bars.length > 1 ? (
        <figure className="sp-bars" aria-label={`每日收入，共 ${days} 日`}>
          <div className="sp-bars-plot" role="img" aria-label="每日收入柱狀圖">
            {bars.map((d) => (
              <i
                key={d.date}
                className={d.revenue === 0 ? 'zero' : undefined}
                style={{ height: `${Math.max(d.revenue === 0 ? 2 : 6, Math.round((d.revenue / max) * 100))}%` }}
                title={`${md(d.date)}：${hkd(d.revenue)}`}
              />
            ))}
          </div>
          <figcaption>
            <span>{md(bars[0].date)}</span>
            <span>最高 {hkd(max)}</span>
            <span>{md(bars[bars.length - 1].date)}</span>
          </figcaption>
        </figure>
      ) : null}
      {b.byMethod.length > 0 ? (
        <ul className="sp-methods">
          {b.byMethod.slice(0, 5).map((m) => (
            <li key={m.label}>
              <span>{m.label}</span>
              <i style={{ width: `${Math.max(4, Math.round((m.revenue / Math.max(1, b.revenue)) * 100))}%` }} aria-hidden />
              <b className="admin-num">{hkd(m.revenue)}</b>
              <small>{m.count} 張</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

// ── Members ──────────────────────────────────────────────────────────────────────────────────
export function MemberStatsCard({ b }: { b: MemberStatsBlock }) {
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: '會員總數', value: String(b.total), sub: `近 30 日 +${b.newLast30Days}` },
    { label: '本週新增', value: String(b.newLast7Days), sub: '近 7 日加入' },
    { label: '有預約', value: String(b.booked), sub: `佔 ${b.bookedPercent}%・從未預約 ${b.neverBooked}` },
    { label: '回頭客', value: String(b.repeat), sub: '預約 2 次或以上' },
  ]
  const tiers = Object.entries(b.tiers)
  return (
    <section className="sp-card" aria-label="會員總覽">
      <header className="sp-card-head">
        <span className="sp-card-kicker">會員</span>
        <span className="sp-card-range">總消費 {hkd(b.totalSpend)}</span>
      </header>
      <div className="sp-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="sp-tile">
            <small>{t.label}</small>
            <b className="admin-num"><CountUp text={t.value} /></b>
            <span>{t.sub}</span>
          </div>
        ))}
      </div>
      {tiers.length > 0 || b.blacklisted > 0 ? (
        <p className="sp-chips">
          {tiers.map(([k, v]) => (
            <span key={k} className="sp-chip">{TIER_LABEL[k] ?? k} {v}</span>
          ))}
          {b.blacklisted > 0 ? <span className="sp-chip warn">黑名單 {b.blacklisted}</span> : null}
        </p>
      ) : null}
    </section>
  )
}

// ── Confirm card ─────────────────────────────────────────────────────────────────────────────
type Op = 'confirm' | 'reject' | 'undo' | 'redo'

const STATUS_TEXT: Record<SparkActionView['status'], string> = {
  pending: '等待你確認',
  executed: '已執行',
  rejected: '已拒絕',
  expired: '已過期',
  failed: '執行失敗',
  undone: '已還原',
}

export function ActionCard({ initial }: { initial: SparkActionView }) {
  const [a, setA] = useState(initial)
  const [busy, setBusy] = useState<Op | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)

  async function run(op: Op) {
    setBusy(op)
    setError(null)
    try {
      const res = await fetch(`/api/admin/spark/actions/${a.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : '操作失敗')
        return
      }
      const next = typeof body === 'object' && body !== null && 'action' in body ? (body as { action: SparkActionView }).action : null
      if (next) setA(next)
      setArmed(false)
    } catch {
      setError('網絡錯誤，請再試')
    } finally {
      setBusy(null)
    }
  }

  const pending = a.status === 'pending'
  const Icon = a.status === 'executed' ? Check : a.status === 'pending' ? ShieldCheck : a.status === 'failed' ? AlertTriangle : a.status === 'undone' ? RotateCcw : CircleSlash

  return (
    <section className={`sp-card sp-action ${a.status}${a.risk === 'high' ? ' high' : ''}`} aria-label="待確認操作">
      <header className="sp-card-head">
        <span className="sp-action-ic" aria-hidden><Icon size={16} /></span>
        <span className="sp-card-kicker">{a.label}</span>
        {a.risk === 'high' ? <span className="sp-chip warn">高風險</span> : null}
        <span className={`sp-status ${a.status}`}>{STATUS_TEXT[a.status]}</span>
      </header>
      <p className="sp-action-sum">{a.summary}</p>
      <dl className="sp-preview">
        {a.preview.map((l, i) => (
          <div key={`${l.label}-${i}`}>
            <dt>{l.label}</dt>
            <dd className={l.tone}>{l.value}</dd>
          </div>
        ))}
      </dl>

      {error ? <p className="sp-action-err" role="alert">{error}</p> : null}
      {a.status === 'failed' && a.error ? <p className="sp-action-err" role="alert">{a.error}</p> : null}

      {pending ? (
        armed ? (
          <div className="sp-action-bar">
            <p className="sp-action-warn"><AlertTriangle size={14} aria-hidden /> 再確認一次：這會真的更改資料{a.kind === 'cancel_booking' ? '，而且無法還原' : ''}。</p>
            <button type="button" className="admin-pill-btn primary" disabled={busy !== null} onClick={() => run('confirm')}>
              {busy === 'confirm' ? '執行中…' : '確定執行'}
            </button>
            <button type="button" className="admin-pill-btn" disabled={busy !== null} onClick={() => setArmed(false)}>返回</button>
          </div>
        ) : (
          <div className="sp-action-bar">
            <button
              type="button"
              className="admin-pill-btn primary"
              disabled={busy !== null}
              onClick={() => (a.risk === 'high' ? setArmed(true) : run('confirm'))}
            >
              {busy === 'confirm' ? '執行中…' : '確認'}
            </button>
            <button type="button" className="admin-pill-btn" disabled={busy !== null} onClick={() => run('reject')}>
              <X size={15} aria-hidden /> {busy === 'reject' ? '處理中…' : '拒絕'}
            </button>
            <span className="sp-action-ttl"><Clock size={13} aria-hidden /> 30 分鐘內有效</span>
          </div>
        )
      ) : null}

      {a.status === 'executed' ? (
        <div className="sp-action-bar">
          <span className="sp-action-ttl">{clock(a.executedAt)} 由 {a.adminEmail.split('@')[0]} 確認</span>
          {a.canUndo ? (
            <button type="button" className="admin-pill-btn" disabled={busy !== null} onClick={() => run('undo')}>
              <RotateCcw size={15} aria-hidden /> {busy === 'undo' ? '還原中…' : '還原'}
            </button>
          ) : (
            <span className="sp-action-ttl">此操作無法還原</span>
          )}
        </div>
      ) : null}

      {a.status === 'undone' ? (
        <div className="sp-action-bar">
          <span className="sp-action-ttl">{clock(a.undoneAt)} 已還原</span>
          {a.canRedo ? (
            <button type="button" className="admin-pill-btn" disabled={busy !== null} onClick={() => run('redo')}>
              <RotateCw size={15} aria-hidden /> {busy === 'redo' ? '重做中…' : '重做'}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export function BlockView({ block }: { block: SparkBlock }) {
  if (block.type === 'income') return <IncomeCard b={block} />
  if (block.type === 'member_stats') return <MemberStatsCard b={block} />
  return <ActionCard initial={(block as ActionBlock).action} />
}
