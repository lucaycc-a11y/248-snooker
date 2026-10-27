'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, ImageIcon, MailWarning } from 'lucide-react'
import type { BugReportRow } from '@/lib/data/getAdminChecks'
import AdminPageHead from './AdminPageHead'
import { useAdminToast } from './ToastProvider'

const SEV = { urgent: '影響營業', annoying: '不便', idea: '建議' } as const
const STATUS = { open: '待處理', in_progress: '處理中', resolved: '已解決' } as const
type Status = keyof typeof STATUS

function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function BugReportsClient({ rows, loadError }: { rows: BugReportRow[]; loadError: string | null }) {
  const router = useRouter()
  const toast = useAdminToast()
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<'active' | 'all'>('active')
  const shown = filter === 'active' ? rows.filter((r) => r.status !== 'resolved') : rows

  const setStatus = async (id: string, status: Status) => {
    const res = await fetch(`/api/admin/bug-report/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.show({ message: `已標記為「${STATUS[status]}」`, tone: 'success' })
      router.refresh()
    } else {
      toast.show({ message: '更新失敗', tone: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        sub="在後台任何頁面按「回報問題」提交的記錄；提交時已電郵通知店主"
        actions={
          <div className="rc-presets">
            <button type="button" className={`admin-pill-btn sm${filter === 'active' ? ' primary' : ''}`} onClick={() => setFilter('active')}>未解決</button>
            <button type="button" className={`admin-pill-btn sm${filter === 'all' ? ' primary' : ''}`} onClick={() => setFilter('all')}>全部</button>
          </div>
        }
      />
      {loadError ? <div className="admin-card ah-alert bad" role="alert">{loadError}</div> : null}
      <section className="admin-card ah-card" aria-label="問題回報">
        {shown.length === 0 ? (
          <div className="ah-empty">
            <Bug size={28} strokeWidth={1.6} aria-hidden />
            <b>{filter === 'active' ? '沒有未解決的問題' : '還沒有問題回報'}</b>
          </div>
        ) : (
          <ul className="br-list">
            {shown.map((r) => (
              <li key={r.id} className={`br-item ${r.severity}`}>
                <button type="button" className="br-head" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
                  <span className={`rc-sev ${r.severity === 'urgent' ? 'high' : r.severity === 'annoying' ? 'medium' : 'low'}`}>{SEV[r.severity]}</span>
                  <b>{r.title}</b>
                  <small>{r.reporter} · {stamp(r.createdAt)}</small>
                  <span className={`br-status ${r.status}`}>{STATUS[r.status]}</span>
                </button>
                {open === r.id ? (
                  <div className="br-body">
                    <p>{r.description}</p>
                    <dl>
                      <dt>頁面</dt><dd>{r.pageUrl ?? '—'}</dd>
                      <dt>螢幕</dt><dd>{r.viewport ?? '—'}</dd>
                      <dt>瀏覽器</dt><dd>{r.userAgent ?? '—'}</dd>
                      <dt>電郵</dt>
                      <dd>
                        {r.emailSentAt ? `已發送 ${stamp(r.emailSentAt)}` : (
                          <span className="br-warn"><MailWarning size={14} aria-hidden /> 未發送{r.emailError ? `：${r.emailError}` : ''}</span>
                        )}
                      </dd>
                      <dt>截圖</dt>
                      <dd>{r.hasScreenshot ? <span><ImageIcon size={14} aria-hidden /> 已附在電郵內</span> : '沒有'}</dd>
                    </dl>
                    {r.recentErrors.length > 0 ? (
                      <>
                        <h4>當時最近的網站錯誤</h4>
                        <ul className="br-errors">
                          {r.recentErrors.map((e, i) => (
                            <li key={`${e.at}-${i}`}><time>{e.at ? stamp(e.at) : ''}</time> <b>{e.source}</b> {e.message}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    <div className="br-actions">
                      {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                        <button key={s} type="button" className={`admin-pill-btn sm${r.status === s ? ' primary' : ''}`} onClick={() => setStatus(r.id, s)} disabled={r.status === s}>
                          {STATUS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
