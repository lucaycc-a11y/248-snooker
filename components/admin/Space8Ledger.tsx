'use client'

/**
 * Space8Ledger — SPACE8 費用帳.
 *
 * Everybody pays first, then claims back from the company a little at a time.
 * Claims only reduce "未 Claim"; they are never counted as expenses.
 * Design: admin-theme.css variables only, no inline hex.
 */

import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Pencil, Plus, Trash2, X } from 'lucide-react'
import AdminPageHead from '@/components/admin/AdminPageHead'
import { DEFAULT_PAYERS, hkd, summarise, type Space8Claim, type Space8Data, type Space8Expense } from '@/lib/admin/space8Ledger'

type Tab = 'overview' | 'expenses' | 'claims'

const pct = (n: number) => `${Math.round(n * 100)}%`
const mLabel = (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'hot' | 'bad' }) {
  return (
    <div className="admin-card" style={tone === 'hot' ? { borderColor: 'var(--admin-green)' } : undefined}>
      <div className="admin-lbl">{label}</div>
      <div
        className="admin-num"
        style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4, color: tone === 'bad' ? 'var(--admin-status-danger)' : undefined }}
      >
        {value}
      </div>
      {hint ? <div className="admin-muted" style={{ fontSize: 13, marginTop: 2 }}>{hint}</div> : null}
    </div>
  )
}

function Bar({ value }: { value: number }) {
  const w = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--admin-bg-tile)', overflow: 'hidden' }} role="progressbar" aria-valuenow={w} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${w}%`, height: '100%', background: 'var(--admin-green)', borderRadius: 4 }} />
    </div>
  )
}

function Scroll({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: 'auto' }}>{children}</div>
}

const num = { textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const }

export default function Space8Ledger({ data, today }: { data: Space8Data; today: string }) {
  const router = useRouter()
  const s = useMemo(() => summarise(data), [data])
  const [tab, setTab] = useState<Tab>('overview')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ai' | 'other'>('all')

  const payerNames = s.payers.map((p) => p.name)
  const [expForm, setExpForm] = useState({ kind: 'other' as 'ai' | 'other', spentOn: today, item: '', amount: '', paidBy: payerNames[0] ?? DEFAULT_PAYERS[0], note: '' })
  const [claimForm, setClaimForm] = useState({ claimedOn: today, amount: '', paidTo: payerNames[0] ?? DEFAULT_PAYERS[0], note: '' })
  const [showForm, setShowForm] = useState<Tab | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  async function send(method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/space8', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => null)
        const err = typeof j === 'object' && j !== null && 'error' in j ? String((j as { error: unknown }).error) : null
        setMsg(err ?? '操作失敗，請再試')
        return false
      }
      router.refresh()
      return true
    } catch {
      setMsg('操作失敗，請再試')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault()
    const ok = await send(editId ? 'PATCH' : 'POST', { type: 'expense', ...(editId ? { id: editId } : {}), ...expForm })
    if (ok) {
      setExpForm((f) => ({ ...f, item: '', amount: '', note: '' }))
      if (editId) closeForm()
    }
  }
  async function addClaim(e: FormEvent) {
    e.preventDefault()
    const ok = await send(editId ? 'PATCH' : 'POST', { type: 'claim', ...(editId ? { id: editId } : {}), ...claimForm })
    if (ok) {
      setClaimForm((f) => ({ ...f, amount: '', note: '' }))
      if (editId) closeForm()
    }
  }
  function closeForm() {
    setEditId(null)
    setShowForm(null)
    setExpForm((f) => ({ ...f, item: '', amount: '', note: '' }))
    setClaimForm((f) => ({ ...f, amount: '', note: '' }))
  }
  function editExpense(e: Space8Expense) {
    setExpForm({ kind: e.kind, spentOn: e.spentOn, item: e.kind === 'ai' ? '' : e.item, amount: String(e.amount), paidBy: e.paidBy, note: e.note ?? '' })
    setEditId(e.id)
    setShowForm('expenses')
  }
  function editClaim(c: Space8Claim) {
    setClaimForm({ claimedOn: c.claimedOn, amount: String(c.amount), paidTo: c.paidTo, note: c.note ?? '' })
    setEditId(c.id)
    setShowForm('claims')
  }
  async function remove(type: 'expense' | 'claim', id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setConfirmId(null)
    await send('DELETE', { type, id })
  }

  async function downloadPdf() {
    setPdfBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/admin/space8/pdf', { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `SPACE8-expenses-${today}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      setMsg('PDF 產生失敗，請再試')
    } finally {
      setPdfBusy(false)
    }
  }

  function claimFor(name: string) {
    const p = s.payers.find((x) => x.name === name)
    setClaimForm((f) => ({ ...f, paidTo: name, amount: p && p.outstanding > 0 ? String(p.outstanding) : '' }))
    setEditId(null)
    setTab('claims')
    setShowForm('claims')
  }

  const expenses = [...data.expenses].filter((e) => filter === 'all' || e.kind === filter).sort((a, b) => (a.spentOn < b.spentOn ? 1 : a.spentOn > b.spentOn ? -1 : 0))
  const claims = [...data.claims].sort((a, b) => (a.claimedOn < b.claimedOn ? 1 : a.claimedOn > b.claimedOn ? -1 : 0))
  const dupNote = data.expenses.some((e) => e.note?.includes('重複'))

  const input = 'admin-field'
  const fieldStyle = { display: 'grid', gap: 4 } as const

  return (
    <div className="admin-stack">
      <AdminPageHead
        sub={`先由各人墊付，再向公司分次 Claim · 截至 ${today} · HKD`}
        actions={
          <button type="button" className="admin-btn primary" onClick={downloadPdf} disabled={pdfBusy}>
            <Download size={16} aria-hidden /> {pdfBusy ? '產生中…' : '匯出 PDF'}
          </button>
        }
      />

      {msg ? <div className="admin-card" role="alert" style={{ color: 'var(--admin-status-danger)' }}>{msg}</div> : null}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Kpi label="總開支（已墊付）" value={hkd(s.expenseTotal)} hint={`AI ${hkd(s.aiTotal)} · 其他 ${hkd(s.otherTotal)}`} />
        <Kpi label="已 Claim" value={hkd(s.claimedTotal)} hint={`${data.claims.length} 次 · 佔開支 ${pct(s.claimPct)}`} />
        <Kpi label="未 Claim" value={hkd(s.outstandingTotal)} hint="開支 − 已 Claim" tone={s.outstandingTotal < 0 ? 'bad' : 'hot'} />
        <Kpi label="資本餘額" value={hkd(s.balance)} hint={`資本 ${hkd(s.capital)} · 已用 ${pct(s.capitalSpentPct)}`} />
      </div>

      <div className="admin-card admin-stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <h3>Claim 進度</h3>
          <span className="admin-muted" style={{ fontSize: 13 }}>Claim 只扣減「未 Claim」，不計入開支</span>
        </div>
        <Bar value={s.claimPct} />
        <Scroll>
          <table className="admin-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>姓名</th>
                <th style={num}>已墊付</th>
                <th style={num}>已 Claim</th>
                <th style={num}>未 Claim</th>
                <th style={{ minWidth: 110 }}>進度</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.payers.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td style={num}>{hkd(p.paid)}</td>
                  <td style={num}>{hkd(p.claimed)}</td>
                  <td style={{ ...num, fontWeight: 700, color: p.outstanding < 0 ? 'var(--admin-status-danger)' : undefined }}>{hkd(p.outstanding)}</td>
                  <td>{p.paid > 0 ? <Bar value={p.claimPct} /> : <span className="admin-muted">—</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className="admin-btn" onClick={() => claimFor(p.name)}>記錄 Claim</button>
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>合計</td>
                <td style={{ ...num, fontWeight: 700 }}>{hkd(s.expenseTotal)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{hkd(s.claimedTotal)}</td>
                <td style={{ ...num, fontWeight: 700 }}>{hkd(s.outstandingTotal)}</td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </Scroll>
      </div>

      <div className="admin-seg" role="tablist" aria-label="檢視" style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 12, width: 'fit-content', maxWidth: '100%' }}>
        {([['overview', '總覽'], ['expenses', `開支明細（${data.expenses.length}）`], ['claims', `Claim 記錄（${data.claims.length}）`]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} className="admin-btn" style={{ border: 'none' }} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <>
          <div className="admin-card admin-stack">
            <h3>每月開支</h3>
            <Scroll>
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th style={{ textAlign: 'left' }}>月份</th><th style={num}>AI Usage</th><th style={num}>其他開支</th><th style={num}>合計</th><th style={num}>累計</th></tr>
                </thead>
                <tbody>
                  {s.months.map((m) => (
                    <tr key={m.month}>
                      <td>{mLabel(m.month)}</td><td style={num}>{hkd(m.ai)}</td><td style={num}>{hkd(m.other)}</td><td style={{ ...num, fontWeight: 600 }}>{hkd(m.total)}</td><td style={num}>{hkd(m.cumulative)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 700 }}>合計</td><td style={{ ...num, fontWeight: 700 }}>{hkd(s.aiTotal)}</td><td style={{ ...num, fontWeight: 700 }}>{hkd(s.otherTotal)}</td><td style={{ ...num, fontWeight: 700 }}>{hkd(s.expenseTotal)}</td><td />
                  </tr>
                </tbody>
              </table>
            </Scroll>
          </div>
          <div className="admin-card admin-stack">
            <h3>其他開支（按項目）</h3>
            <Scroll>
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th style={{ textAlign: 'left' }}>項目</th><th style={num}>次數</th><th style={num}>金額</th><th style={num}>佔比</th><th style={num}>平均</th></tr>
                </thead>
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.item}>
                      <td>{i.item}</td><td style={num}>{i.entries}</td><td style={{ ...num, fontWeight: 600 }}>{hkd(i.amount)}</td><td style={num}>{pct(i.pct)}</td><td style={num}>{hkd(i.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroll>
          </div>
        </>
      ) : null}

      {tab === 'expenses' ? (
        <div className="admin-card admin-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3>開支明細</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select className={input} value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'ai' | 'other')} aria-label="篩選類別">
                <option value="all">全部</option>
                <option value="ai">AI Usage</option>
                <option value="other">其他開支</option>
              </select>
              <button type="button" className="admin-btn primary" onClick={() => (showForm === 'expenses' ? closeForm() : (setEditId(null), setShowForm('expenses')))}>
                {showForm === 'expenses' ? <X size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {showForm === 'expenses' ? '取消' : '新增開支'}
              </button>
            </div>
          </div>
          {dupNote ? <div className="admin-muted" style={{ fontSize: 13 }}>標示「重複」的一行係 Excel 原本已有兩次，請確認後可刪除。</div> : null}
          {showForm === 'expenses' ? (
            <form onSubmit={addExpense} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
              <label style={fieldStyle}><span className="admin-lbl">類別</span>
                <select className={input} value={expForm.kind} onChange={(e) => setExpForm({ ...expForm, kind: e.target.value as 'ai' | 'other' })}>
                  <option value="other">其他開支</option><option value="ai">AI Usage</option>
                </select>
              </label>
              <label style={fieldStyle}><span className="admin-lbl">日期</span>
                <input className={input} type="date" required value={expForm.spentOn} onChange={(e) => setExpForm({ ...expForm, spentOn: e.target.value })} />
              </label>
              {expForm.kind === 'other' ? (
                <label style={fieldStyle}><span className="admin-lbl">項目</span>
                  <input className={input} required maxLength={80} value={expForm.item} onChange={(e) => setExpForm({ ...expForm, item: e.target.value })} list="space8-items" />
                  <datalist id="space8-items">{s.items.map((i) => <option key={i.item} value={i.item} />)}</datalist>
                </label>
              ) : null}
              <label style={fieldStyle}><span className="admin-lbl">金額（HKD）</span>
                <input className={input} type="number" inputMode="decimal" step="0.01" min="0.01" required value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
              </label>
              <label style={fieldStyle}><span className="admin-lbl">墊付人</span>
                <select className={input} value={expForm.paidBy} onChange={(e) => setExpForm({ ...expForm, paidBy: e.target.value })}>
                  {payerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={fieldStyle}><span className="admin-lbl">備註（可選）</span>
                <input className={input} maxLength={200} value={expForm.note} onChange={(e) => setExpForm({ ...expForm, note: e.target.value })} />
              </label>
              <button type="submit" className="admin-btn primary" disabled={busy}>{busy ? '儲存中…' : editId ? '更新' : '儲存'}</button>
            </form>
          ) : null}
          <Scroll>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr><th style={{ textAlign: 'left' }}>日期</th><th style={{ textAlign: 'left' }}>項目</th><th style={num}>金額</th><th style={{ textAlign: 'left' }}>墊付人</th><th /></tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.spentOn}</td>
                    <td>{e.item}{e.note ? <div className="admin-muted" style={{ fontSize: 12 }}>{e.note}</div> : null}</td>
                    <td style={num}>{hkd(e.amount)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.paidBy}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="admin-btn" onClick={() => editExpense(e)} disabled={busy} aria-label="編輯開支">
                        <Pencil size={14} aria-hidden />
                      </button>{' '}
                      <button type="button" className="admin-btn" onClick={() => remove('expense', e.id)} disabled={busy} aria-label="刪除開支">
                        <Trash2 size={14} aria-hidden /> {confirmId === e.id ? '確定刪除？' : ''}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroll>
        </div>
      ) : null}

      {tab === 'claims' ? (
        <div className="admin-card admin-stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h3>Claim 記錄</h3>
            <button type="button" className="admin-btn primary" onClick={() => (showForm === 'claims' ? closeForm() : (setEditId(null), setShowForm('claims')))}>
              {showForm === 'claims' ? <X size={16} aria-hidden /> : <Plus size={16} aria-hidden />} {showForm === 'claims' ? '取消' : '記錄 Claim'}
            </button>
          </div>
          {showForm === 'claims' ? (
            <form onSubmit={addClaim} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', alignItems: 'end' }}>
              <label style={fieldStyle}><span className="admin-lbl">Claim 日期</span>
                <input className={input} type="date" required value={claimForm.claimedOn} onChange={(e) => setClaimForm({ ...claimForm, claimedOn: e.target.value })} />
              </label>
              <label style={fieldStyle}><span className="admin-lbl">付予（墊付人）</span>
                <select className={input} value={claimForm.paidTo} onChange={(e) => setClaimForm({ ...claimForm, paidTo: e.target.value })}>
                  {payerNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={fieldStyle}><span className="admin-lbl">金額（HKD）</span>
                <input className={input} type="number" inputMode="decimal" step="0.01" min="0.01" required value={claimForm.amount} onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })} />
              </label>
              <label style={fieldStyle}><span className="admin-lbl">備註（可選）</span>
                <input className={input} maxLength={200} value={claimForm.note} onChange={(e) => setClaimForm({ ...claimForm, note: e.target.value })} />
              </label>
              <button type="submit" className="admin-btn primary" disabled={busy}>{busy ? '儲存中…' : editId ? '更新' : '儲存'}</button>
            </form>
          ) : null}
          {claims.length === 0 ? (
            <div className="admin-muted">未有 Claim 記錄。每次向公司 Claim 完，㩒「記錄 Claim」輸入金額，未 Claim 就會自動扣減。</div>
          ) : (
            <Scroll>
              <table className="admin-table" style={{ width: '100%' }}>
                <thead>
                  <tr><th style={{ textAlign: 'left' }}>日期</th><th style={{ textAlign: 'left' }}>付予</th><th style={num}>金額</th><th style={{ textAlign: 'left' }}>備註</th><th /></tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.claimedOn}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.paidTo}</td>
                      <td style={num}>{hkd(c.amount)}</td>
                      <td>{c.note ?? ''}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="admin-btn" onClick={() => editClaim(c)} disabled={busy} aria-label="編輯 Claim">
                          <Pencil size={14} aria-hidden />
                        </button>{' '}
                        <button type="button" className="admin-btn" onClick={() => remove('claim', c.id)} disabled={busy} aria-label="刪除 Claim">
                          <Trash2 size={14} aria-hidden /> {confirmId === c.id ? '確定刪除？' : ''}
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 700 }}>合計</td><td /><td style={{ ...num, fontWeight: 700 }}>{hkd(s.claimedTotal)}</td><td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </Scroll>
          )}
        </div>
      ) : null}
    </div>
  )
}
