'use client'

/**
 * 跟進名單 — who needs a nudge.
 *  - 未完成付款: started checkout (pending / failed / expired) but never paid
 *  - 已註冊未預約: signed up, no confirmed booking
 * Data comes from the shared server loader; the browser never filters hidden accounts.
 */

import Link from 'next/link'
import { useCallback, useMemo, useState } from 'react'
import AdminQuickLinks from '@/components/admin/AdminQuickLinks'
import type { FollowUps, NoBookingPerson, UnpaidPerson } from '@/lib/data/getAdminFollowUps'

type Tab = 'unpaid' | 'nobooking'

const STATUS_LABEL: Record<string, string> = {
  pending: '付款中（未完成）',
  payment_failed: '付款失敗',
  expired: '逾時未付款',
}

const DAY_OPTIONS = [7, 14, 30, 90]

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const full = digits.length === 8 ? `852${digits}` : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

function fmtHk(iso: string): string {
  return new Date(iso).toLocaleString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour12: false,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs} 小時前`
  return `${Math.floor(hrs / 24)} 日前`
}

function ContactButtons({ phone, email, text }: { phone: string | null; email: string | null; text: string }) {
  const wa = waLink(phone, text)
  return (
    <div className="admin-row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {wa ? (
        <a className="admin-btn sm primary" href={wa} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      ) : null}
      {phone ? (
        <a className="admin-btn sm" href={`tel:${phone}`}>
          致電
        </a>
      ) : null}
      {email ? (
        <a className="admin-btn sm" href={`mailto:${email}?body=${encodeURIComponent(text)}`}>
          電郵
        </a>
      ) : null}
      {!phone && !email ? <span className="admin-muted">沒有聯絡方法</span> : null}
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="admin-card admin-stack" style={{ gap: 6 }}>
      <div className="admin-lbl">{label}</div>
      <div className="admin-num" style={{ fontSize: 26, lineHeight: 1.1 }}>
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

function Who({ name, code, phone, email }: { name: string | null; code: string | null; phone: string | null; email: string | null }) {
  return (
    <div>
      <div className="admin-cell-main">{name || code || email || '（未填名稱）'}</div>
      <div className="admin-cell-sub admin-mono">{[code, phone].filter(Boolean).join(' · ')}</div>
      {email ? <div className="admin-cell-sub">{email}</div> : null}
    </div>
  )
}

export default function FollowUpsClient({ initial }: { initial: FollowUps }) {
  const [data, setData] = useState<FollowUps>(initial)
  const [tab, setTab] = useState<Tab>('unpaid')
  const [days, setDays] = useState(initial.unpaidDays)
  const [hidePaid, setHidePaid] = useState(true)
  const [onlyTried, setOnlyTried] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initial.error)

  const reload = useCallback(async (d: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/follow-ups?days=${d}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as (FollowUps & { error?: string }) | null
      if (!res.ok || !json || json.error) {
        setError(json?.error ?? `載入失敗（${res.status}）`)
        return
      }
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  const term = q.trim().toLowerCase().replace(/\s/g, '')
  const match = (p: { displayName: string | null; phone: string | null; email: string | null; memberCode: string | null }) =>
    !term ||
    [p.displayName, p.phone, p.email, p.memberCode].join(' ').toLowerCase().replace(/\s/g, '').includes(term)

  const unpaid = useMemo(
    () => data.unpaid.filter((p) => (!hidePaid || !p.paidLater) && match(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.unpaid, hidePaid, term],
  )
  const noBooking = useMemo(
    () => data.noBooking.filter((p) => (!onlyTried || p.hasUnpaidAttempt) && match(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.noBooking, onlyTried, term],
  )

  const stillUnpaid = data.unpaid.filter((p) => !p.paidLater).length
  const neverBooked = data.noBooking.length
  const triedNotPaid = data.noBooking.filter((p) => p.hasUnpaidAttempt).length

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text-primary)' }} data-cms-key="admin.follow_ups.title">
            跟進名單
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.follow_ups.subtitle">
            撳咗付款但冇付錢，或者註冊咗但未預約嘅會員 — 一撳就可以 WhatsApp / 致電 / 電郵
          </p>
        </div>
        <AdminQuickLinks current="followups" />
      </header>

      {error ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-danger)' }}>
          <p style={{ color: 'var(--admin-danger)' }}>
            {error}{' '}
            <button type="button" className="admin-btn sm" onClick={() => void reload(days)}>
              重試
            </button>
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="未完成付款（仍未預約成功）" value={stillUnpaid} hint={`最近 ${data.unpaidDays} 日`} />
        <Stat label="已註冊但未有成功預約" value={neverBooked} hint="不含隱藏帳戶、測試預約" />
        <Stat label="其中曾嘗試付款但失敗／逾時" value={triedNotPaid} hint="最值得跟進" />
      </div>

      <section className="admin-card admin-stack" style={{ gap: 12 }}>
        <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
          <div className="admin-seg" role="group" aria-label="名單">
            <button type="button" aria-pressed={tab === 'unpaid'} onClick={() => setTab('unpaid')}>
              未完成付款
            </button>
            <button type="button" aria-pressed={tab === 'nobooking'} onClick={() => setTab('nobooking')}>
              已註冊未預約
            </button>
          </div>
          <div className="admin-field" style={{ flex: 1, minWidth: 200 }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱、電話、電郵、會員編號" aria-label="搜尋" />
          </div>
        </div>

        {tab === 'unpaid' ? (
          <div className="admin-row" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div className="admin-seg" role="group" aria-label="時間範圍">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => {
                    setDays(d)
                    void reload(d)
                  }}
                >
                  {d} 日
                </button>
              ))}
            </div>
            <label className="admin-check">
              <input type="checkbox" checked={hidePaid} onChange={(e) => setHidePaid(e.target.checked)} />
              <span>隱藏之後已成功付款嘅人</span>
            </label>
            {loading ? <span className="admin-muted">載入中…</span> : null}
          </div>
        ) : (
          <label className="admin-check">
            <input type="checkbox" checked={onlyTried} onChange={(e) => setOnlyTried(e.target.checked)} />
            <span>只顯示曾嘗試付款嘅人</span>
          </label>
        )}

        {tab === 'unpaid' ? <UnpaidTable rows={unpaid} /> : <NoBookingTable rows={noBooking} />}
      </section>
    </div>
  )
}

function UnpaidTable({ rows }: { rows: UnpaidPerson[] }) {
  if (rows.length === 0) return <div className="admin-empty">冇需要跟進嘅未完成付款 🎉</div>
  return (
    <div className="admin-list">
      {rows.map((p) => {
        const last = p.attempts[0]
        const slot = last.date ? `${last.date} ${(last.startTime ?? '').slice(0, 5)}` : '時段不明'
        const text = `你好${p.displayName ? ` ${p.displayName}` : ''}，我哋係 Space8。見到你想預約 ${slot}，但付款未完成。需要我哋幫手嗎？`
        return (
          <div key={p.userId} className="admin-li" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <Who name={p.displayName} code={p.memberCode} phone={p.phone} email={p.email} />
              <div style={{ marginTop: 6 }}>
                {p.paidLater ? <span className="admin-tag">之後已付款</span> : <span className="admin-tag warn">仍未付款</span>}
                {p.confirmedCount === 0 ? <span className="admin-tag">新客</span> : null}
              </div>
            </div>
            <div style={{ minWidth: 240, flex: 2 }}>
              {p.attempts.slice(0, 3).map((a) => (
                <div key={a.bookingId} className="admin-cell-sub" style={{ marginBottom: 4 }}>
                  <span className={a.status === 'payment_failed' ? 'admin-tag bad' : 'admin-tag warn'}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>{' '}
                  {a.date} {(a.startTime ?? '').slice(0, 5)} · 枱 {a.tableNumber ?? '-'} · HK${a.price}
                  {a.promoCode ? ` · 優惠碼 ${a.promoCode}` : ''} · {fmtHk(a.createdAt)}（{ago(a.createdAt)}）
                </div>
              ))}
              {p.attempts.length > 3 ? <div className="admin-muted">另有 {p.attempts.length - 3} 次嘗試</div> : null}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <ContactButtons phone={p.phone} email={p.email} text={text} />
              <Link className="admin-btn sm" href={`/admin/bookings?search=${encodeURIComponent(p.phone ?? p.memberCode ?? '')}`}>
                睇預約紀錄
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function NoBookingTable({ rows }: { rows: NoBookingPerson[] }) {
  if (rows.length === 0) return <div className="admin-empty">所有會員都已有預約 🎉</div>
  return (
    <div className="admin-list">
      {rows.map((p) => {
        const text = `你好${p.displayName ? ` ${p.displayName}` : ''}，歡迎加入 Space8！如果想預約枱或有任何問題，隨時話我哋知。`
        return (
          <div key={p.userId} className="admin-li" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <Who name={p.displayName} code={p.memberCode} phone={p.phone} email={p.email} />
            </div>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div className="admin-cell-sub">
                註冊於 {fmtHk(p.createdAt)}（{p.daysSinceSignup === 0 ? '今日' : `${p.daysSinceSignup} 日前`}）
              </div>
              <div style={{ marginTop: 6 }}>
                {p.hasUnpaidAttempt ? <span className="admin-tag warn">曾嘗試付款但未成功</span> : null}
                {!p.phoneVerified ? <span className="admin-tag">電話未驗證</span> : null}
              </div>
            </div>
            <ContactButtons phone={p.phone} email={p.email} text={text} />
          </div>
        )
      })}
    </div>
  )
}
