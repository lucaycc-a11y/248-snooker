'use client'

/**
 * Member picker + fill-in form. The search runs in the browser against an admin-only endpoint;
 * what the admin sees here (names, emails) is never sent to the AI — only the chosen member code.
 */

import { useEffect, useRef, useState } from 'react'
import { Search, UserRound, X } from 'lucide-react'
import { ActionCard } from './SparkBlocks'
import type { MemberHit } from '@/lib/spark/members'
import type { FormBlock } from '@/lib/spark/agent'
import type { SparkActionView } from '@/lib/spark/actions'

const TIER_LABEL: Record<string, string> = { amateur: '業餘', century: '百分', maximum: '滿分' }
const hkd = (n: number): string => `HK$${n.toLocaleString('en-HK')}`

export function MemberRow({ m, onClick, active }: { m: MemberHit; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="sp-mp-av" aria-hidden>{(m.name ?? m.code).slice(0, 1).toUpperCase()}</span>
      <span className="sp-mp-main">
        <b>{m.name ?? '（未有名稱）'}</b>
        <small className="admin-mono">{m.code}</small>
        {m.email ? <small>{m.email}{m.phoneTail ? `・電話 …${m.phoneTail}` : ''}</small> : null}
      </span>
      <span className="sp-mp-side">
        <span className="sp-chip">{TIER_LABEL[m.tier] ?? m.tier}</span>
        <small className="admin-num">{hkd(m.credits)}・{m.points} 分</small>
        {m.blacklisted ? <span className="sp-chip warn">黑名單</span> : null}
        {m.hidden ? <span className="sp-chip">隱藏帳戶</span> : null}
      </span>
    </>
  )
  return onClick ? (
    <button type="button" className={`sp-mp-row${active ? ' active' : ''}`} onClick={onClick}>{body}</button>
  ) : (
    <div className="sp-mp-row static">{body}</div>
  )
}

export function MemberPicker({ initialQuery = '', onPick, autoFocus = true }: { initialQuery?: string; onPick: (m: MemberHit) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState(initialQuery)
  const [rows, setRows] = useState<MemberHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    const id = ++seq.current
    setLoading(true)
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/spark/members?q=${encodeURIComponent(q)}`)
        const body: unknown = await res.json().catch(() => null)
        if (id !== seq.current) return
        if (!res.ok || typeof body !== 'object' || body === null || !Array.isArray((body as { members?: unknown }).members)) {
          setError('搜尋失敗，請再試')
          setRows([])
        } else {
          setError(null)
          setRows((body as { members: MemberHit[] }).members)
        }
      } catch {
        if (id === seq.current) setError('網絡錯誤，請再試')
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, q === '' ? 0 : 250)
    return () => window.clearTimeout(t)
  }, [q])

  return (
    <div className="sp-mp">
      <label className="sp-mp-search">
        <Search size={16} aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜尋姓名、電郵、電話或會員編號"
          aria-label="搜尋會員"
          autoFocus={autoFocus}
          autoComplete="off"
          inputMode="search"
        />
        {q ? <button type="button" aria-label="清除" onClick={() => setQ('')}><X size={14} aria-hidden /></button> : null}
      </label>
      <div className="sp-mp-list" role="listbox" aria-busy={loading}>
        {error ? <p className="sp-error">{error}</p> : null}
        {!error && !loading && rows.length === 0 ? <p className="sp-muted">搵唔到符合嘅會員</p> : null}
        {rows.map((m) => (
          <MemberRow key={m.code} m={m} onClick={() => onPick(m)} />
        ))}
      </div>
      {q === '' && rows.length > 0 ? <p className="sp-mp-hint">最近加入嘅會員；輸入文字搜尋全部</p> : null}
    </div>
  )
}

const CREDIT_QUICK = [10, 20, 50, 100, 200]
const POINT_QUICK = [50, 100, 200, 500]
const REASONS = ['補償客人（服務問題）', '活動獎勵贈送', '手動更正錯誤記錄', '客人投訴補償']

export function FormCard({ block, chatId }: { block: FormBlock; chatId: string | null }) {
  const credit = block.kind === 'adjust_credit'
  const [member, setMember] = useState<MemberHit | null>(null)
  const [picking, setPicking] = useState(block.memberCode === '')
  const [sign, setSign] = useState<1 | -1>(block.amount !== null && block.amount < 0 ? -1 : 1)
  const [amount, setAmount] = useState(block.amount !== null ? String(Math.abs(block.amount)) : '')
  const [reason, setReason] = useState(block.reason)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<SparkActionView | null>(null)

  useEffect(() => {
    if (!block.memberCode) return
    void (async () => {
      try {
        const res = await fetch(`/api/admin/spark/members?q=${encodeURIComponent(block.memberCode)}`)
        const body: unknown = await res.json().catch(() => null)
        const list = typeof body === 'object' && body !== null && Array.isArray((body as { members?: unknown }).members) ? ((body as { members: MemberHit[] }).members) : []
        const hit = list.find((m) => m.code === block.memberCode)
        if (hit) setMember(hit)
        else setPicking(true)
      } catch {
        setPicking(true)
      }
    })()
  }, [block.memberCode])

  if (action) return <ActionCard initial={action} />

  const n = Number(amount)
  const validAmount = Number.isInteger(n) && n > 0
  const signed = validAmount ? n * sign : 0
  const after = member && validAmount ? (credit ? member.credits : member.points) + signed : null
  const ready = member !== null && validAmount && reason.trim().length >= 5 && (after === null || after >= 0)
  const quick = credit ? CREDIT_QUICK : POINT_QUICK
  const unit = credit ? 'HK$' : '分'

  async function submit() {
    if (!member || !ready) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/spark/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: block.kind,
          chatId,
          args: credit ? { memberCode: member.code, amount: signed, reason: reason.trim() } : { memberCode: member.code, delta: signed, reason: reason.trim() },
        }),
      })
      const body: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body === 'object' && body !== null && 'error' in body ? String((body as { error: unknown }).error) : '提交失敗')
        return
      }
      const a = typeof body === 'object' && body !== null && 'action' in body ? (body as { action: SparkActionView }).action : null
      if (a) setAction(a)
    } catch {
      setError('網絡錯誤，請再試')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="sp-card sp-form" aria-label={credit ? '加減錢包額度' : '加減積分'}>
      <header className="sp-card-head">
        <span className="sp-card-kicker">{credit ? '調整錢包額度' : '調整積分'}</span>
        <span className="sp-card-range">填好後會產生確認卡，不會即時更改</span>
      </header>

      <div className="sp-field">
        <span className="sp-label">會員</span>
        {member && !picking ? (
          <div className="sp-picked">
            <MemberRow m={member} />
            <button type="button" className="admin-pill-btn" onClick={() => setPicking(true)}>更換</button>
          </div>
        ) : (
          <div className="sp-field-box">
            <MemberPicker
              initialQuery=""
              autoFocus={false}
              onPick={(m) => {
                setMember(m)
                setPicking(false)
              }}
            />
            {member ? <button type="button" className="admin-pill-btn" onClick={() => setPicking(false)}>取消</button> : null}
          </div>
        )}
      </div>

      <div className="sp-field">
        <span className="sp-label">{credit ? '金額' : '積分'}</span>
        <div className="sp-amount">
          <div className="sp-seg" role="group" aria-label="加或扣">
            <button type="button" aria-pressed={sign === 1} onClick={() => setSign(1)}>加</button>
            <button type="button" aria-pressed={sign === -1} onClick={() => setSign(-1)}>扣</button>
          </div>
          <label className="sp-input">
            <span>{unit}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 5))} inputMode="numeric" placeholder="0" aria-label="數量" />
          </label>
        </div>
        <div className="sp-quick">
          {quick.map((v) => (
            <button key={v} type="button" onClick={() => setAmount(String(v))} aria-pressed={n === v}>{v}</button>
          ))}
        </div>
        {member && validAmount ? (
          <p className={`sp-after${after !== null && after < 0 ? ' bad' : ''}`}>
            {credit ? '錢包' : '積分'}：{credit ? hkd(member.credits) : `${member.points} 分`} → <b>{credit ? hkd(after ?? 0) : `${after ?? 0} 分`}</b>
            {after !== null && after < 0 ? '（餘額不足）' : ''}
          </p>
        ) : null}
      </div>

      <div className="sp-field">
        <span className="sp-label">原因（至少 5 個字，會記入紀錄）</span>
        <input className="sp-text" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 200))} placeholder="例如：補償冷氣故障" aria-label="原因" />
        <div className="sp-quick text">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r}>{r}</button>
          ))}
        </div>
      </div>

      {error ? <p className="sp-action-err" role="alert">{error}</p> : null}
      <div className="sp-action-bar">
        <button type="button" className="admin-pill-btn primary" disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? '處理中…' : '產生確認卡'}
        </button>
        <span className="sp-action-ttl"><UserRound size={13} aria-hidden /> {member ? member.code : '請先揀會員'}</span>
      </div>
    </section>
  )
}
