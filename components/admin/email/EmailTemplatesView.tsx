'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Trash2, Sparkles } from 'lucide-react'
import { personalise, renderDoc, sanitizeDoc } from '@/lib/email-composer/doc'
import { STARTERS, type Starter } from '@/lib/email-composer/starters'

export type SavedTemplate = { id: string; name: string; subject: string; doc: unknown; custom_html: string | null; updated_at: string }

function Thumb({ html }: { html: string }) {
  return (
    <div className="em-thumb-wrap" aria-hidden>
      <iframe title="" tabIndex={-1} sandbox="" srcDoc={html} loading="lazy" />
    </div>
  )
}

export function TemplatesView({ templates, onOpen, onStarter, onDelete, onNew }: {
  templates: SavedTemplate[]; onOpen: (t: SavedTemplate) => void; onStarter: (s: Starter) => void; onDelete: (t: SavedTemplate) => void; onNew: () => void
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const saved = useMemo(() => templates.filter((t) => !needle || `${t.name} ${t.subject}`.toLowerCase().includes(needle)), [templates, needle])
  const starters = useMemo(() => STARTERS.filter((s) => !needle || `${s.name} ${s.hint}`.toLowerCase().includes(needle)), [needle])

  return (
    <div className="em-tv">
      <div className="em-tv-bar">
        <label className="em-search"><Search size={16} aria-hidden /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋範本…" aria-label="搜尋範本" /></label>
        <button type="button" className="admin-pill-btn primary" onClick={onNew}><Plus size={15} aria-hidden /> 新電郵</button>
      </div>

      <h3 className="em-tv-h">我的範本</h3>
      {saved.length === 0 ? <p className="em-note">{templates.length === 0 ? '未有儲存嘅範本。喺「撰寫」撳「儲存」，或由下面嘅起始範本開始。' : '搵唔到。'}</p> : (
        <ul className="em-grid">
          {saved.map((t) => {
            const d = sanitizeDoc(t.doc)
            const html = personalise(t.custom_html ?? (d ? renderDoc(d) : ''), { name: 'Luca' })
            return (
              <li key={t.id}>
                <button type="button" className="em-card" onClick={() => onOpen(t)}>
                  <Thumb html={html} />
                  <b>{t.name}</b><small>{t.subject}</small>
                  <small className="em-date">{new Date(t.updated_at).toLocaleDateString('zh-HK')}{t.custom_html ? ' · HTML' : ''}</small>
                </button>
                <button type="button" className="em-card-x" aria-label={`刪除 ${t.name}`} onClick={() => onDelete(t)}><Trash2 size={14} /></button>
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="em-tv-h"><Sparkles size={14} aria-hidden /> 起始範本</h3>
      <ul className="em-grid">
        {starters.map((s) => (
          <li key={s.key}>
            <button type="button" className="em-card" onClick={() => onStarter(s)}>
              <Thumb html={personalise(renderDoc(s.doc()), { name: 'Luca' })} />
              <b>{s.name}</b><small>{s.hint}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Send = { id: string; subject: string; audience_kind: 'test' | 'members' | 'all'; recipient_count: number; sent_count: number; failed_count: number; admin_email: string | null; created_at: string }
const KIND: Record<Send['audience_kind'], string> = { test: '測試', members: '指定會員', all: '全部會員' }

export function HistoryView() {
  const [rows, setRows] = useState<Send[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void fetch('/api/admin/email/history').then((r) => r.json().then((d: unknown) => ({ ok: r.ok, d }))).then(({ ok, d }) => {
      if (!alive) return
      if (ok && typeof d === 'object' && d !== null && 'sends' in d) setRows((d as { sends: Send[] }).sends)
      else setErr('載入記錄失敗')
    }).catch(() => alive && setErr('網絡錯誤'))
    return () => { alive = false }
  }, [])
  if (err) return <p className="em-err">{err}</p>
  if (!rows) return <p className="em-note"><Loader2 size={14} className="sp-spin" aria-hidden /> 載入中…</p>
  if (rows.length === 0) return <p className="em-note">未有發送記錄。</p>
  return (
    <div className="overflow-x-auto">
      <table className="em-hist">
        <thead><tr><th>時間</th><th>標題</th><th>收件人</th><th>成功／失敗</th><th>發送者</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.created_at).toLocaleString('zh-HK')}</td>
              <td>{r.subject}</td>
              <td>{KIND[r.audience_kind]}（{r.recipient_count}）</td>
              <td>{r.sent_count} / {r.failed_count}</td>
              <td>{r.admin_email ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
