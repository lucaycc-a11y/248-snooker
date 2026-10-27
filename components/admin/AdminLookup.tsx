import Link from 'next/link'
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CircleDot,
  CreditCard,
  Mail,
  MessageCircle,
  Phone,
  Search,
  XCircle,
} from 'lucide-react'
import type { AdminLookupData, LookupBooking, LookupEvent } from '@/lib/data/getAdminLookup'
import { dateLabel, money } from '@/lib/admin/today'
import AdminPageHead from './AdminPageHead'
import AdminStatusBadge from './AdminStatusBadge'

// 客戶查詢 — server component. The search box is a plain GET form, so results
// are linkable (/admin/lookup?q=91234567) and work without client JS.

function hhmm(value: string | null): string {
  return (value ?? '').slice(0, 5) || '—'
}

function phoneLabel(raw: string | null): string {
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('852') && digits.length === 11 ? digits.slice(3) : digits
  return local.length === 8 ? `${local.slice(0, 4)} ${local.slice(4)}` : raw
}

function waHref(raw: string | null): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits.length === 8 ? `852${digits}` : digits}`
}

function stamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

const KIND_ICON: Record<LookupEvent['kind'], typeof CircleDot> = {
  booking: CalendarClock,
  attempt: CreditCard,
  event: CircleDot,
  cancel: XCircle,
  notify: MessageCircle,
}

function BookingRows({ rows, q, activeId }: { rows: LookupBooking[]; q: string; activeId?: string }) {
  return (
    <ul className="ah-rows">
      {rows.map((b) => (
        <li key={b.id} className={b.id === activeId ? 'live' : b.status !== 'confirmed' ? 'past' : ''}>
          <span className="ah-time admin-num">
            <b>{b.date ? b.date.slice(5).replace('-', '/') : '—'}</b>
            <small>{hhmm(b.startTime)}</small>
          </span>
          <Link href={`/admin/lookup?${new URLSearchParams({ q, booking: b.id }).toString()}`} className="ah-row-main" style={{ gridColumn: 'span 2' }}>
            <b className="admin-mono">{b.code ?? b.id.slice(0, 8)}</b>
            <small>房 {b.table} · {money(b.price)}{b.method ? ` · ${b.method}` : ''}</small>
          </Link>
          <span className="ar-badges">
            {b.isTest ? <AdminStatusBadge label="測試" tone="test" /> : null}
            <AdminStatusBadge status={b.status} />
          </span>
          <span />
        </li>
      ))}
    </ul>
  )
}

export default function AdminLookup({ data }: { data: AdminLookupData }) {
  const q = data.query
  const searched = q.length >= 2
  const hasPicked = Boolean(data.member || data.booking)

  return (
    <>
      <AdminPageHead sub="輸入電話、會員編號、電郵、姓名、預約碼或 KPay 訂單號碼，查看客人的所有預約及付款經過" />

      <form method="get" action="/admin/lookup" className="admin-card al-search" role="search">
        <Search size={20} aria-hidden />
        <input
          name="q"
          defaultValue={q}
          placeholder="例：9123 4567、S8-1001、SPACE8-A14K-7"
          autoFocus={!hasPicked}
          autoComplete="off"
          aria-label="搜尋客人或預約"
        />
        <button type="submit" className="admin-pill-btn primary">搜尋</button>
      </form>

      {data.error ? <div className="admin-card ah-alert bad" role="alert">{data.error}</div> : null}

      {searched && !hasPicked ? (
        <div className="ah-grid">
          <section className="admin-card ah-card s2" aria-label="會員">
            <div className="ah-card-head"><h3>會員<span className="ah-count">{data.members.length}</span></h3></div>
            {data.members.length === 0 ? (
              <div className="ah-empty"><b>找不到相符的會員</b><span>試試只輸入電話最後 4 位</span></div>
            ) : (
              <ul className="ah-mini">
                {data.members.map((m) => (
                  <li key={m.id}>
                    <Link href={`/admin/lookup?${new URLSearchParams({ q, user: m.id }).toString()}`}>
                      <span className="ah-av sm" aria-hidden>{(m.name ?? '?').slice(0, 1).toUpperCase()}</span>
                      <span className="ah-mini-main">
                        <b>{m.name ?? '未登記姓名'}</b>
                        <small>{phoneLabel(m.phone)} · {m.memberCode ?? '—'}</small>
                      </span>
                      <span className="ah-mini-amt">{m.tier ?? ''}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="admin-card ah-card s2" aria-label="預約">
            <div className="ah-card-head"><h3>預約<span className="ah-count">{data.bookings.length}</span></h3></div>
            {data.bookings.length === 0 ? (
              <div className="ah-empty"><b>找不到相符的預約</b><span>預約碼或 KPay 訂單號碼可只輸入部分</span></div>
            ) : (
              <BookingRows rows={data.bookings} q={q} />
            )}
          </section>
        </div>
      ) : null}

      {!searched && !hasPicked ? (
        <div className="admin-card ah-empty al-hint">
          <Search size={28} strokeWidth={1.6} aria-hidden />
          <b>由客人提供的任何資料開始</b>
          <span>例如客人來電說「我付咗錢但冇收到確認」，輸入佢的電話即可看到所有付款嘗試及 KPay 回覆</span>
        </div>
      ) : null}

      {hasPicked ? (
        <div className="ah-grid">
          {data.member ? (
            <section className="admin-card ah-card al-profile" aria-label="會員資料">
              <div className="ah-card-head">
                <h3>會員資料</h3>
                <Link href={`/admin/members/${data.member.id}`} className="admin-pill-btn sm">會員頁</Link>
              </div>
              <div className="al-profile-body">
                <span className="ah-av al-av" aria-hidden>{(data.member.name ?? '?').slice(0, 1).toUpperCase()}</span>
                <p className="ah-next-name">{data.member.name ?? '未登記姓名'}</p>
                <p className="admin-mono al-code">{data.member.memberCode ?? '—'}{data.member.tier ? ` · ${data.member.tier}` : ''}</p>
                <ul className="ar-facts">
                  <li>
                    <span><Phone size={14} aria-hidden /> 電話</span>
                    <b>
                      {phoneLabel(data.member.phone)}{' '}
                      {data.member.phoneVerified ? <BadgeCheck size={14} aria-label="已驗證" style={{ color: 'var(--admin-green)', verticalAlign: '-2px' }} /> : <small className="al-warn">未驗證</small>}
                    </b>
                  </li>
                  <li><span><Mail size={14} aria-hidden /> 電郵</span><b className="al-ellip">{data.member.email ?? '—'}</b></li>
                  <li><span>積分</span><b className="admin-num">{data.member.points}</b></li>
                  <li><span>錢包額度</span><b className="admin-num">{money(data.member.credits)}</b></li>
                  <li><span>加入</span><b>{stamp(data.member.createdAt)}</b></li>
                  {data.memberStats ? (
                    <>
                      <li><span>已確認預約</span><b className="admin-num">{data.memberStats.confirmed}（未來 {data.memberStats.upcoming}）</b></li>
                      <li><span>累計消費</span><b className="admin-num">{money(data.memberStats.spend)}</b></li>
                      <li><span>取消</span><b className="admin-num">{data.memberStats.cancelled}</b></li>
                    </>
                  ) : null}
                </ul>
                {data.member.blacklisted ? (
                  <p className="al-black"><Ban size={14} aria-hidden /> 此帳戶在黑名單</p>
                ) : null}
                <div className="ah-next-contact">
                  {waHref(data.member.phone) ? (
                    <a href={waHref(data.member.phone) ?? '#'} target="_blank" rel="noreferrer" className="admin-pill-btn">
                      <MessageCircle size={18} aria-hidden />WhatsApp
                    </a>
                  ) : null}
                  {data.member.phone ? (
                    <a href={`tel:${data.member.phone}`} className="admin-pill-btn"><Phone size={18} aria-hidden />致電</a>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {data.booking ? (
            <section className={`admin-card ah-card ${data.member ? 's3' : 's4'}`} aria-label="付款經過">
              <div className="ah-card-head">
                <h3>
                  <span className="admin-mono">{data.booking.code ?? data.booking.id.slice(0, 8)}</span>
                  <AdminStatusBadge status={data.booking.status} />
                  {data.booking.isTest ? <AdminStatusBadge label="測試" tone="test" /> : null}
                </h3>
                <Link href={`/admin/bookings/${data.booking.id}`} className="admin-pill-btn sm">開啟預約</Link>
              </div>
              <p className="al-sub">
                {dateLabel(data.booking.date)} {hhmm(data.booking.startTime)}–{hhmm(data.booking.endTime)} · 房 {data.booking.table} · {money(data.booking.price)}
              </p>
              {data.timeline.length === 0 ? (
                <div className="ah-empty"><b>沒有付款或系統記錄</b></div>
              ) : (
                <ol className="al-timeline">
                  {data.timeline.map((e, i) => {
                    const Icon = KIND_ICON[e.kind]
                    return (
                      <li key={`${e.at}-${i}`} className={e.tone}>
                        <span className="al-dot" aria-hidden><Icon size={14} /></span>
                        <div>
                          <b>{e.title}</b>
                          {e.detail ? <small>{e.detail}</small> : null}
                        </div>
                        <time className="admin-num">{stamp(e.at)}</time>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          ) : null}

          {data.member ? (
            <section className={`admin-card ah-card ${data.booking ? 's4' : 's3'}`} aria-label="所有預約">
              <div className="ah-card-head">
                <h3>所有預約<span className="ah-count">{data.memberBookings.length}</span></h3>
                <span className="admin-sub">點擊任何一張查看付款經過</span>
              </div>
              {data.memberBookings.length === 0 ? (
                <div className="ah-empty"><b>此會員未有預約</b></div>
              ) : (
                <BookingRows rows={data.memberBookings} q={q} activeId={data.booking?.id} />
              )}
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
