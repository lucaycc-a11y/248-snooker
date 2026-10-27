'use client'

/**
 * AdminReport — 每日報告. One day at a glance: money (vs the same weekday last
 * week), room usage, hour-by-hour load, payment methods, payment attempt
 * outcomes, new members and the full booking list. Printable.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import type { AdminReportData } from '@/lib/data/getAdminReport'
import { dateLabel, money, shiftDate } from '@/lib/admin/today'
import AdminPageHead from './AdminPageHead'
import AdminStatusBadge from './AdminStatusBadge'

function hhmm(value: string | null): string {
  return (value ?? '').slice(0, 5) || '—'
}

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return <span className="ar-delta">與上週同日相同</span>
  if (before === 0) return <span className="ar-delta up"><TrendingUp size={14} aria-hidden />上週同日沒有收入</span>
  const pct = Math.round(((now - before) / before) * 100)
  const up = pct >= 0
  return (
    <span className={`ar-delta ${up ? 'up' : 'down'}`}>
      {up ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
      {up ? '+' : ''}{pct}%（上週同日 {money(before)}）
    </span>
  )
}

function Bars({ rows, total }: { rows: { label: string; value: number; sub: string }[]; total: number }) {
  if (rows.length === 0) return <p className="ar-none">沒有資料</p>
  return (
    <ul className="ar-hbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="ar-hbar-label">{r.label}</span>
          <span className="ar-hbar-track">
            <i style={{ width: `${total > 0 ? Math.max(3, (r.value / total) * 100) : 0}%` }} />
          </span>
          <span className="ar-hbar-val admin-num">{r.sub}</span>
        </li>
      ))}
    </ul>
  )
}

export default function AdminReport({ data }: { data: AdminReportData }) {
  const router = useRouter()
  const go = (iso: string) => router.push(iso === data.todayDate ? '/admin/report' : `/admin/report?date=${iso}`)
  const t = data.totals
  const isToday = data.date === data.todayDate
  const attemptsTotal = data.attempts.succeeded + data.attempts.failed + data.attempts.expired + data.attempts.other

  return (
    <>
      <AdminPageHead
        sub={`${dateLabel(data.date)}${isToday ? '（今日，數字會隨新預約更新）' : ''} · 不包括測試預約及隱藏帳戶`}
        actions={
          <>
            <div className="ah-date-nav ar-noprint">
              <button type="button" className="ah-ic-btn" onClick={() => go(shiftDate(data.date, -1))} aria-label="前一日">
                <ChevronLeft size={18} aria-hidden />
              </button>
              <input
                type="date"
                className="ar-date"
                value={data.date}
                max={data.todayDate}
                onChange={(e) => e.target.value && go(e.target.value)}
                aria-label="選擇日期"
              />
              <button
                type="button"
                className="ah-ic-btn"
                onClick={() => go(shiftDate(data.date, 1))}
                aria-label="後一日"
                disabled={isToday}
              >
                <ChevronRight size={18} aria-hidden />
              </button>
            </div>
            <button type="button" className="admin-pill-btn ar-noprint" onClick={() => window.print()}>
              <Printer size={18} aria-hidden />
              列印
            </button>
          </>
        }
      />

      {data.error ? (
        <div className="admin-card ah-alert bad" role="alert">部分資料載入失敗：{data.error}</div>
      ) : null}

      <div className="ah-grid">
        <div className="admin-card ah-stat hero">
          <span className="ah-stat-top"><span className="ah-stat-label">收入</span></span>
          <b className="ah-stat-num">{money(t.revenue)}</b>
          <span className="ah-stat-foot"><Delta now={t.revenue} before={data.lastWeek.revenue} /></span>
        </div>
        <div className="admin-card ah-stat">
          <span className="ah-stat-top"><span className="ah-stat-label">淨收入</span></span>
          <b className="ah-stat-num">{money(t.net)}</b>
          <span className="ah-stat-foot">退款 {money(t.refund)} · 平均每張 {money(t.averagePerBooking)}</span>
        </div>
        <div className="admin-card ah-stat">
          <span className="ah-stat-top"><span className="ah-stat-label">預約</span></span>
          <b className="ah-stat-num">{data.activeCount}</b>
          <span className="ah-stat-foot">
            已確認 {t.bookingCount} 張 · 取消／失效 {data.cancelledCount} 張
          </span>
        </div>
        <div className="admin-card ah-stat">
          <span className="ah-stat-top"><span className="ah-stat-label">房間使用率</span></span>
          <b className="ah-stat-num">{data.occupancyPct}%</b>
          <span className="ah-stat-foot">
            共 {data.bookedHours} 小時 · {data.tableCount} 間房 {String(data.openHour).padStart(2, '0')}:00–{String(data.closeHour % 24).padStart(2, '0')}:00
          </span>
        </div>

        <section className="admin-card ah-card s3" aria-label="每小時使用">
          <div className="ah-card-head"><h3>每小時使用</h3></div>
          <div className="ar-hours" role="img" aria-label="每小時有客人的房間數">
            {data.hours.map((h) => (
              <div key={h.hour} className="ar-hour" title={`${h.hour}:00 有 ${h.roomsBusy} 間房使用中`}>
                <span className={`ar-cell l${Math.min(2, Math.round((h.roomsBusy / Math.max(1, data.tableCount)) * 2))}`}>
                  {h.roomsBusy > 0 ? h.roomsBusy : ''}
                </span>
                <small>{String(h.hour).padStart(2, '0')}</small>
              </div>
            ))}
          </div>
          <div className="ah-legend">
            <span><i className="ar-l0" />空置</span>
            <span><i className="ar-l1" />部分房間</span>
            <span><i className="ar-l2" />全部房間</span>
          </div>
        </section>

        <section className="admin-card ah-card" aria-label="其他">
          <div className="ah-card-head"><h3>付款與會員</h3></div>
          <ul className="ar-facts">
            <li><span>付款成功</span><b className="admin-num">{data.attempts.succeeded}</b></li>
            <li><span>付款失敗</span><b className={`admin-num${data.attempts.failed > 0 ? ' bad' : ''}`}>{data.attempts.failed}</b></li>
            <li><span>逾時／取消</span><b className="admin-num">{data.attempts.expired}</b></li>
            <li><span>付款成功率</span><b className="admin-num">{attemptsTotal > 0 ? `${Math.round((data.attempts.succeeded / attemptsTotal) * 100)}%` : '—'}</b></li>
            <li><span>新會員</span><b className="admin-num">{data.newMembers}</b></li>
            <li><span>優惠碼折扣</span><b className="admin-num">{money(t.promoDiscount)}</b></li>
            <li><span>積分／錢包抵扣</span><b className="admin-num">{money(t.pointsDiscount + t.creditDiscount)}</b></li>
          </ul>
        </section>

        <section className="admin-card ah-card s2" aria-label="付款方式">
          <div className="ah-card-head"><h3>付款方式</h3></div>
          <Bars
            total={t.revenue}
            rows={data.byMethod.map((m) => ({ label: m.label, value: m.revenue, sub: `${money(m.revenue)} · ${m.count}` }))}
          />
        </section>

        <section className="admin-card ah-card s2" aria-label="各房收入">
          <div className="ah-card-head"><h3>各房收入</h3></div>
          <Bars
            total={t.revenue}
            rows={data.byTable.map((m) => ({ label: m.label, value: m.revenue, sub: `${money(m.revenue)} · ${m.count} 張` }))}
          />
          {data.promos.length > 0 ? (
            <>
              <div className="ah-card-head"><h3>優惠碼</h3></div>
              <ul className="ar-facts">
                {data.promos.map((p) => (
                  <li key={p.code}><span className="admin-mono">{p.code}</span><b className="admin-num">{p.uses} 次 · −{money(p.totalDiscount)}</b></li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="admin-card ah-card s4" aria-label="預約明細">
          <div className="ah-card-head">
            <h3>預約明細<span className="ah-count">{data.bookings.length}</span></h3>
            <Link href={`/admin/bookings?dateFrom=${data.date}&dateTo=${data.date}`} className="admin-pill-btn sm ar-noprint">在預約列表開啟</Link>
          </div>
          {data.bookings.length === 0 ? (
            <div className="ah-empty"><b>當日沒有預約</b></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>房</th>
                    <th>客人</th>
                    <th>預約碼</th>
                    <th className="admin-num">金額</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="ar-tnum">{hhmm(b.startTime)}–{hhmm(b.endTime)}</td>
                      <td>房 {b.tableNumber}</td>
                      <td>{b.userName ?? '未登記姓名'}</td>
                      <td><Link href={`/admin/bookings/${b.id}`} className="admin-mono">{b.humanCode ?? b.id.slice(0, 8)}</Link></td>
                      <td className="admin-num">{money(b.price)}</td>
                      <td><AdminStatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
