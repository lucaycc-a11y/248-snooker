import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CreditCard,
  DoorOpen,
  ShieldCheck,
  Webhook,
} from 'lucide-react'
import type { ActivityFilter, ActivityKind, AdminActivityData } from '@/lib/data/getAdminActivity'
import AdminPageHead from './AdminPageHead'

// 網站記錄 — server component. Filters are plain links so every view has a URL
// that can be shared ("/admin/activity?type=payment&problems=1").

const KINDS: { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'booking', label: '預約' },
  { id: 'payment', label: '付款' },
  { id: 'webhook', label: 'KPay 通知' },
  { id: 'error', label: '錯誤' },
  { id: 'admin', label: '管理員操作' },
  { id: 'notify', label: '通知' },
  { id: 'gate', label: '網站閘門' },
]

const ICON: Record<ActivityKind, typeof Bell> = {
  booking: CalendarClock,
  payment: CreditCard,
  webhook: Webhook,
  error: AlertTriangle,
  admin: ShieldCheck,
  notify: Bell,
  gate: DoorOpen,
}

function hkDay(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'long', day: 'numeric', weekday: 'short' })
}

function hkTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-HK', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AdminActivity({ data }: { data: AdminActivityData }) {
  const href = (next: Partial<{ type: ActivityFilter; hours: number; problems: boolean }>) => {
    const type = next.type ?? data.filter
    const hours = next.hours ?? data.hours
    const problems = next.problems ?? data.problemsOnly
    const p = new URLSearchParams()
    if (type !== 'all') p.set('type', type)
    if (hours !== 24) p.set('hours', String(hours))
    if (problems) p.set('problems', '1')
    const qs = p.toString()
    return `/admin/activity${qs ? `?${qs}` : ''}`
  }

  // Group by HK day.
  const groups: { day: string; items: AdminActivityData['items'] }[] = []
  for (const it of data.items) {
    const day = hkDay(it.at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(it)
    else groups.push({ day, items: [it] })
  }

  return (
    <>
      <AdminPageHead sub="預約、付款、KPay 通知、錯誤、管理員操作及通知的完整時間線（香港時間）" />

      {data.error ? <div className="admin-card ah-alert bad" role="alert">部分記錄載入失敗：{data.error}</div> : null}

      <section className="aa-health" aria-label="系統狀態">
        {data.health.map((h) => {
          const inner = (
            <>
              <span className="aa-h-label">{h.label}</span>
              <b className="aa-h-value">{h.value}</b>
              <span className="aa-h-hint">{h.hint}</span>
            </>
          )
          return h.href ? (
            <Link key={h.key} href={h.href} className={`admin-card aa-h ${h.tone}`}>{inner}</Link>
          ) : (
            <div key={h.key} className={`admin-card aa-h ${h.tone}`}>{inner}</div>
          )
        })}
      </section>

      <div className="aa-filters">
        <nav className="aa-chips" aria-label="記錄類別">
          {KINDS.map((k) => (
            <Link key={k.id} href={href({ type: k.id })} className="aa-chip" aria-current={data.filter === k.id ? 'page' : undefined}>
              {k.label}
              {k.id !== 'all' && data.counts[k.id as ActivityKind] > 0 ? <span>{data.counts[k.id as ActivityKind]}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="aa-chips">
          {[24, 72, 168].map((h) => (
            <Link key={h} href={href({ hours: h })} className="aa-chip" aria-current={data.hours === h ? 'page' : undefined}>
              {h === 24 ? '24 小時' : h === 72 ? '3 日' : '7 日'}
            </Link>
          ))}
          <Link href={href({ problems: !data.problemsOnly })} className="aa-chip warn" aria-current={data.problemsOnly ? 'page' : undefined}>
            <AlertTriangle size={14} aria-hidden />
            只看問題
          </Link>
        </div>
      </div>

      <section className="admin-card ah-card" aria-label="記錄">
        {groups.length === 0 ? (
          <div className="ah-empty">
            <ShieldCheck size={28} strokeWidth={1.6} aria-hidden />
            <b>{data.problemsOnly ? '這段時間沒有問題' : '這段時間沒有記錄'}</b>
            {data.problemsOnly ? <Link href={href({ problems: false })} className="admin-pill-btn sm">顯示全部記錄</Link> : null}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.day} className="aa-group">
              <h4 className="aa-day">{g.day}</h4>
              <ol className="aa-list">
                {g.items.map((it) => {
                  const Icon = ICON[it.kind]
                  const body = (
                    <>
                      <time className="admin-num">{hkTime(it.at)}</time>
                      <span className={`aa-ic ${it.tone}`} aria-hidden><Icon size={15} /></span>
                      <span className="aa-text">
                        <b>{it.title}</b>
                        {it.detail ? <small>{it.detail}</small> : null}
                      </span>
                    </>
                  )
                  return (
                    <li key={it.id} className={it.tone}>
                      {it.href ? <Link href={it.href}>{body}</Link> : <div>{body}</div>}
                    </li>
                  )
                })}
              </ol>
            </div>
          ))
        )}
      </section>
    </>
  )
}
