'use client'

/**
 * 客務中心 — one place for customer problems.
 *   工單: list + detail. Detail has 身份核對 (email OTP), 全託管付款連結, Spark 協助,
 *         回覆範本 and a timeline.
 *   範本: edit the reply wording templates.
 * Design system: admin-dash.css classes only (ad-*, cs-*). No `any`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Markdown } from '@/components/admin/AiText'

type Category = 'payment' | 'booking' | 'account' | 'website' | 'other'
type Status = 'open' | 'pending' | 'resolved'
type Customer = { id: string; email: string | null; displayName: string | null; memberCode: string | null; phone: string | null }
type CaseRow = {
  id: string
  created_at: string
  updated_at: string
  status: Status
  category: Category
  subject: string
  detail: string | null
  user_id: string | null
  customer_email: string | null
  booking_code: string | null
  website_issue: boolean
  owner_notified_at: string | null
  auto_report_at: string | null
  created_by: string
  resolution_note: string | null
}
type Note = { id: number; created_at: string; author: string; kind: string; body: string }
type Template = { id: string; title: string; category: Category; body: string }
type LinkResult = {
  bookingId: string
  humanCode: string
  amount: number
  standardAmount: number
  phoneUrl: string
  desktopUrl: string
  holdMinutes: number
  summary: string
}

const CAT_LABEL: Record<Category, string> = { payment: '付款', booking: '預約', account: '帳戶', website: '網站問題', other: '其他' }
const STATUS_LABEL: Record<Status, string> = { open: '處理中', pending: '待跟進', resolved: '已解決' }
const KIND_LABEL: Record<string, string> = { note: '備註', otp: '驗證', payment_link: '付款連結', reply: '回覆', spark: 'Spark', system: '系統' }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

async function api(method: 'GET' | 'POST', query: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/admin/cs${query}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json: unknown = await res.json().catch(() => null)
  const data = isRecord(json) ? json : {}
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : '操作失敗，請重試')
  return data
}

const hk = (iso: string): string => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(5, 16).replace('T', ' ')
const msg = (e: unknown): string => (e instanceof Error ? e.message : '操作失敗')

function CopyButton({ text, label = '複製' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="ad-btn cs-sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        })
      }}
    >
      {done ? '已複製' : label}
    </button>
  )
}

/* ── Customer picker ───────────────────────────────────── */
function CustomerPicker({ onPick }: { onPick: (c: Customer) => void }) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<Customer[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const search = async () => {
    setBusy(true)
    setNote('')
    try {
      const d = await api('GET', `?view=customers&q=${encodeURIComponent(q)}`)
      const rows = Array.isArray(d.customers) ? (d.customers as Customer[]) : []
      setList(rows)
      if (rows.length === 0) setNote('找不到會員')
    } catch (e) {
      setNote(msg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="cs-stack">
      <form className="cs-row" onSubmit={(e) => { e.preventDefault(); void search() }}>
        <input className="ad-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="電郵、電話、會員編號、姓名或預約編號" />
        <button type="submit" className="ad-btn ad-btn-primary" disabled={busy || q.trim().length < 2}>{busy ? '搜尋中…' : '搜尋'}</button>
      </form>
      {note ? <p className="ad-muted">{note}</p> : null}
      {list.map((c) => (
        <button key={c.id} type="button" className="cs-pick" onClick={() => onPick(c)}>
          <b>{c.displayName ?? '（未有姓名）'}</b>
          <span className="ad-muted">{[c.memberCode, c.email, c.phone].filter(Boolean).join(' · ')}</span>
        </button>
      ))}
    </div>
  )
}

/* ── New case ──────────────────────────────────────────── */
function NewCase({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [category, setCategory] = useState<Category>('payment')
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [bookingCode, setBookingCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const d = await api('POST', '', { action: 'create_case', category, subject, detail, bookingCode, userId: customer?.id })
      const c = isRecord(d.case) ? d.case : null
      if (c && typeof c.id === 'string') {
        // Spark investigates the account + Vercel logs in the background and emails Luca.
        void api('POST', '', { action: 'auto_diagnose', caseId: c.id }).catch(() => undefined)
        onCreated(c.id)
      }
    } catch (e) {
      setError(msg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>新工單</h3>
      <div className="cs-stack">
        <span className="cs-lbl">客人</span>
        {customer ? (
          <div className="cs-row">
            <span className="ad-chip">{customer.displayName ?? customer.memberCode ?? customer.email}</span>
            <button type="button" className="ad-btn cs-sm" onClick={() => setCustomer(null)}>更換</button>
          </div>
        ) : (
          <CustomerPicker onPick={setCustomer} />
        )}
      </div>
      <div className="cs-grid2">
        <label className="ad-field">
          <span>類別</span>
          <select className="ad-input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="ad-field">
          <span>預約編號（如有）</span>
          <input className="ad-input" value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} placeholder="例如 SPACE8-…" />
        </label>
      </div>
      <label className="ad-field">
        <span>標題</span>
        <input className="ad-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="一句講清楚問題" />
      </label>
      <label className="ad-field">
        <span>詳情</span>
        <textarea className="ad-input cs-ta" rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </label>
      {category === 'website' ? <p className="cs-hint">網站問題工單建立後，系統會自動電郵通知網站負責人，並附上系統健康快照。</p> : null}
      {error ? <p className="cs-err">{error}</p> : null}
      <div className="cs-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={busy || subject.trim().length < 3} onClick={() => void submit()}>{busy ? '建立中…' : '建立工單'}</button>
        <button type="button" className="ad-btn" onClick={onCancel}>取消</button>
      </div>
    </section>
  )
}

/* ── Feature cards (used inside a case and as stand-alone pages) ───────── */
function OtpCard({ customer, caseId, onDone }: { customer: Customer | null; caseId: string | null; onDone: () => void }) {
  const [otpMsg, setOtpMsg] = useState('')
  const [otpOk, setOtpOk] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const send = async () => {
    if (!customer) return
    setBusy(true)
    setOtpMsg('')
    try {
      const d = await api('POST', '', { action: 'otp_send', caseId, userId: customer.id })
      setOtpOk(false)
      setOtpMsg(`驗證碼已發送到 ${String(d.sentTo)}，10 分鐘內有效`)
      onDone()
    } catch (e) {
      setOtpMsg(msg(e))
    } finally {
      setBusy(false)
    }
  }
  const verify = async () => {
    if (!customer) return
    setBusy(true)
    try {
      await api('POST', '', { action: 'otp_verify', caseId, userId: customer.id, code })
      setOtpOk(true)
      setOtpMsg('身份核對成功')
      setCode('')
      onDone()
    } catch (e) {
      setOtpOk(false)
      setOtpMsg(msg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>身份核對（電郵驗證碼）</h3>
      <p className="ad-muted">向客人登記的電郵發送 6 位數驗證碼，客人讀出驗證碼後在此輸入核對。</p>
      <div className="cs-row">
        <button type="button" className="ad-btn" disabled={!customer || busy} onClick={() => void send()}>發送驗證碼</button>
      </div>
      <div className="cs-row">
        <input className="ad-input cs-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6 位驗證碼" />
        <button type="button" className="ad-btn ad-btn-primary" disabled={!customer || busy || code.length !== 6} onClick={() => void verify()}>核對</button>
      </div>
      {otpMsg ? <p className={otpOk ? 'cs-ok' : 'cs-hint'}>{otpMsg}</p> : null}
    </section>
  )
}

function LinkCard({ customer, caseId, link, setLink, onDone }: { customer: Customer | null; caseId: string | null; link: LinkResult | null; setLink: (l: LinkResult | null) => void; onDone: () => void }) {
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState('')
  const [duration, setDuration] = useState('1')
  const [table, setTable] = useState('1')
  const [price, setPrice] = useState('')
  const [standard, setStandard] = useState<number | null>(null)
  const [quoteNote, setQuoteNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const customerId = customer?.id ?? null
  useEffect(() => {
    setStandard(null)
    setQuoteNote('')
    if (!customerId || !date || startHour === '' || !duration) return
    const timer = setTimeout(() => {
      void api('POST', '', { action: 'link_quote', userId: customerId, date, startHour: Number(startHour), duration: Number(duration) })
        .then((d) => setStandard(Number(d.total)))
        .catch((e) => setQuoteNote(msg(e)))
    }, 350)
    return () => clearTimeout(timer)
  }, [customerId, date, startHour, duration])
  const create = async () => {
    if (!customer) return
    setBusy(true)
    setLinkMsg('')
    try {
      const d = await api('POST', '', { action: 'link_create', caseId, userId: customer.id, date, startHour: Number(startHour), duration: Number(duration), tableNumber: Number(table), price: price.trim() === '' ? undefined : Number(price) })
      setLink({
        bookingId: String(d.bookingId),
        humanCode: String(d.humanCode),
        amount: Number(d.amount),
        standardAmount: Number(d.standardAmount),
        phoneUrl: String(d.phoneUrl),
        desktopUrl: String(d.desktopUrl),
        holdMinutes: Number(d.holdMinutes),
        summary: `${date} ${String(startHour).padStart(2, '0')}:00 起 ${duration} 小時 房${table}`,
      })
      onDone()
    } catch (e) {
      setLinkMsg(msg(e))
    } finally {
      setBusy(false)
    }
  }
  const check = async () => {
    if (!link) return
    setBusy(true)
    setLinkMsg('')
    try {
      const d = await api('POST', '', { action: 'link_check', caseId, bookingId: link.bookingId })
      const outcome = String(d.outcome)
      if (outcome === 'confirmed' || outcome === 'already_confirmed') setLinkMsg('已收到付款，預約已確認，確認電郵已發送')
      else if (outcome === 'needs_review') setLinkMsg('已收到付款但需要人手審核，請到「付款」頁處理')
      else if (outcome === 'pending') {
        setLinkMsg('客人未付款，已重新生成連結')
        if (typeof d.phoneUrl === 'string' && typeof d.desktopUrl === 'string') setLink({ ...link, phoneUrl: d.phoneUrl, desktopUrl: d.desktopUrl })
      } else if (outcome === 'closed') setLinkMsg('付款單已過期或關閉，請重新生成連結')
      else setLinkMsg('暫時未能向 KPay 核實，請稍後再試')
      onDone()
    } catch (e) {
      setLinkMsg(msg(e))
    } finally {
      setBusy(false)
    }
  }
  const email = async () => {
    if (!customer || !link) return
    setBusy(true)
    try {
      await api('POST', '', { action: 'link_email', caseId, userId: customer.id, url: link.phoneUrl, humanCode: link.humanCode, amount: link.amount, summary: link.summary })
      setLinkMsg('已電郵付款連結俾客人')
      onDone()
    } catch (e) {
      setLinkMsg(msg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>全託管付款連結</h3>
      <p className="ad-muted">網站未能付款時使用：預留時段並生成 KPay 收銀台連結，客人付款後自動確認預約並發送確認電郵。</p>
      <div className="cs-form">
        <label className="ad-field cs-span"><span>日期</span><input className="ad-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="ad-field"><span>開始（時）</span><input className="ad-input" type="number" min={0} max={23} value={startHour} onChange={(e) => setStartHour(e.target.value)} placeholder="19" /></label>
        <label className="ad-field"><span>時數</span><input className="ad-input" type="number" min={1} max={8} value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
        <label className="ad-field"><span>房間</span>
          <select className="ad-input" value={table} onChange={(e) => setTable(e.target.value)}><option value="1">房 1</option><option value="2">房 2</option></select>
        </label>
      </div>
      <div className="cs-price">
        <div className="cs-price-std">
          <span className="cs-lbl">標準價（按會員等級計算）</span>
          <b>{standard !== null ? `HK$${standard}` : '—'}</b>
        </div>
        <label className="ad-field">
          <span>自訂價錢（HK$，留空 = 用標準價）</span>
          <input className="ad-input" type="number" min={1.5} max={5000} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={standard !== null ? String(standard) : '例如 200'} />
        </label>
        {quoteNote ? <p className="cs-hint">{quoteNote}</p> : null}
        {price.trim() !== '' && standard !== null && Number(price) !== standard ? <p className="cs-hint">會以 HK${Number(price) || 0} 收費，並記錄為自訂價錢（標準價 HK${standard}）。</p> : null}
      </div>
      <button type="button" className="ad-btn ad-btn-primary" disabled={!customer || busy || !date || startHour === ''} onClick={() => void create()}>{busy ? '處理中…' : '生成付款連結'}</button>
      {link ? (
        <div className="cs-link">
          <div className="cs-row cs-between"><b className="ad-mono">{link.humanCode}</b><b className="cs-amount">HK${link.amount}</b></div>
          {link.amount !== link.standardAmount ? <span className="ad-chip" data-tone="warn">自訂價錢 · 標準價 HK${link.standardAmount}</span> : null}
          <p className="ad-muted">{link.summary} · 時段預留 {link.holdMinutes} 分鐘，連結過期請重新生成</p>
          <div className="cs-row"><span className="cs-lbl">手機</span><CopyButton text={link.phoneUrl} /><CopyButton text={link.desktopUrl} label="複製電腦版" /></div>
          <div className="cs-row">
            <button type="button" className="ad-btn" disabled={busy} onClick={() => void email()}>電郵連結俾客人</button>
            <button type="button" className="ad-btn" disabled={busy} onClick={() => void check()}>核實付款</button>
          </div>
        </div>
      ) : null}
      {linkMsg ? <p className="cs-hint">{linkMsg}</p> : null}
    </section>
  )
}

function SparkCard({ caseId, onDone }: { caseId: string | null; onDone: () => void }) {
  const [extra, setExtra] = useState('')
  const [diag, setDiag] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState<'' | 'diagnose' | 'reply' | 'ask'>('')
  const [err, setErr] = useState('')
  const run = async (mode: 'diagnose' | 'reply' | 'ask') => {
    setBusy(mode)
    setErr('')
    try {
      const d = await api('POST', '', mode === 'ask' ? { action: 'spark_ask', prompt: extra } : { action: mode === 'diagnose' ? 'spark_diagnose' : 'spark_reply', caseId, extra })
      if (mode === 'reply') setDraft(String(d.text ?? ''))
      else setDiag(String(d.text ?? ''))
      onDone()
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>Spark 協助</h3>
      <p className="ad-muted">Spark 會自動查付款、預約、KPay 狀態、Vercel 日誌和資料庫狀況（只讀，不會改任何資料）。</p>
      <textarea className="ad-input cs-ta" rows={caseId ? 2 : 4} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={caseId ? '補充資料（選填），例如客人話咩時間、點付款' : '問 Spark，例如：網站而家有冇問題？今日有冇付款失敗？預約 SPACE8-… 點解未確認？'} />
      <div className="cs-row">
        {caseId ? (
          <>
            <button type="button" className="ad-btn ad-btn-primary" disabled={busy !== ''} onClick={() => void run('diagnose')}>{busy === 'diagnose' ? 'Spark 調查中…' : 'Spark 診斷'}</button>
            <button type="button" className="ad-btn" disabled={busy !== ''} onClick={() => void run('reply')}>{busy === 'reply' ? 'Spark 起草中…' : 'Spark 起草回覆'}</button>
          </>
        ) : (
          <button type="button" className="ad-btn ad-btn-primary" disabled={busy !== '' || extra.trim().length < 3} onClick={() => void run('ask')}>{busy === 'ask' ? 'Spark 調查中…' : '問 Spark'}</button>
        )}
      </div>
      {err ? <p className="cs-err">{err}</p> : null}
      {diag ? <div className="cs-ai"><Markdown text={diag} /></div> : null}
      {draft ? (
        <div className="cs-stack">
          <span className="cs-lbl">回覆草稿（可修改）</span>
          <textarea className="ad-input cs-ta" rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="cs-row"><CopyButton text={draft} /></div>
        </div>
      ) : null}
    </section>
  )
}

function TemplatePanel({ customer, caseId, code, link, templates, onDone }: { customer: Customer | null; caseId: string | null; code: string; link: string; templates: Template[]; onDone: () => void }) {
  const [tplId, setTplId] = useState('')
  const [result, setResult] = useState('')
  const [reply, setReply] = useState('')
  const fill = async () => {
    const t = templates.find((x) => x.id === tplId)
    if (!t) return
    try {
      const d = await api('POST', '', { action: 'template_fill', userId: customer?.id, body: t.body, code, link, result })
      setReply(String(d.text ?? ''))
    } catch (e) {
      setReply(msg(e))
    }
  }
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>套用回覆範本</h3>
      <div className="cs-grid2">
        <label className="ad-field"><span>範本</span>
          <select className="ad-input" value={tplId} onChange={(e) => setTplId(e.target.value)}>
            <option value="">選擇範本…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{CAT_LABEL[t.category]} · {t.title}</option>)}
          </select>
        </label>
        <label className="ad-field"><span>處理結果（填入 {'{{result}}'}）</span>
          <input className="ad-input" value={result} onChange={(e) => setResult(e.target.value)} placeholder="例如：款項已確認收到，預約已成功" />
        </label>
      </div>
      <div className="cs-row"><button type="button" className="ad-btn" disabled={!tplId} onClick={() => void fill()}>套用範本</button></div>
      {reply ? (
        <div className="cs-stack">
          <textarea className="ad-input cs-ta" rows={8} value={reply} onChange={(e) => setReply(e.target.value)} />
          <div className="cs-row">
            <CopyButton text={reply} />
            {caseId ? <button type="button" className="ad-btn" onClick={() => { void api('POST', '', { action: 'add_note', caseId, kind: 'reply', body: reply }).then(onDone) }}>記錄為已回覆</button> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

/** Stand-alone tool pages: pick a customer first, then the card. */
function WithCustomer({ children }: { children: (c: Customer | null) => React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  return (
    <div className="cs-stack">
      <section className="admin-card cs-pad cs-stack">
        <span className="cs-lbl">客人</span>
        {customer ? (
          <div className="cs-row">
            <span className="ad-chip">{customer.displayName ?? customer.memberCode ?? customer.email}</span>
            <span className="ad-muted">{[customer.memberCode, customer.phone].filter(Boolean).join(' · ')}</span>
            <button type="button" className="ad-btn cs-sm" onClick={() => setCustomer(null)}>更換</button>
          </div>
        ) : (
          <CustomerPicker onPick={setCustomer} />
        )}
      </section>
      {children(customer)}
    </div>
  )
}

/* ── Case detail ───────────────────────────────────────── */
function CaseDetail({ id, templates, onBack, onChanged }: { id: string; templates: Template[]; onBack: () => void; onChanged: () => void }) {
  const [c, setC] = useState<CaseRow | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadErr, setLoadErr] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api('GET', `?view=case&id=${id}`)
      setC(isRecord(d.case) ? (d.case as unknown as CaseRow) : null)
      setNotes(Array.isArray(d.notes) ? (d.notes as Note[]) : [])
      setCustomer(isRecord(d.customer) ? (d.customer as unknown as Customer) : null)
    } catch (e) {
      setLoadErr(msg(e))
    }
  }, [id])
  useEffect(() => { void load() }, [load])

  const [link, setLink] = useState<LinkResult | null>(null)

  // Notes + status
  const [note, setNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [busy, setBusy] = useState(false)
  const addNote = async () => {
    if (!note.trim()) return
    setBusy(true)
    try {
      await api('POST', '', { action: 'add_note', caseId: id, body: note })
      setNote('')
      await load()
    } finally {
      setBusy(false)
    }
  }
  const update = async (patch: Record<string, unknown>) => {
    setBusy(true)
    try {
      await api('POST', '', { action: 'update_case', caseId: id, ...patch })
      await load()
      onChanged()
    } catch (e) {
      setLoadErr(msg(e))
    } finally {
      setBusy(false)
    }
  }
  const attach = async (cu: Customer) => {
    try {
      await api('POST', '', { action: 'attach_customer', caseId: id, userId: cu.id })
      await load()
    } catch (e) {
      setLoadErr(msg(e))
    }
  }

  if (loadErr && !c) return <section className="admin-card cs-pad"><p className="cs-err">{loadErr}</p><button type="button" className="ad-btn" onClick={onBack}>返回</button></section>
  if (!c) return <section className="admin-card cs-pad"><p className="ad-muted">載入中…</p></section>

  return (
    <div className="cs-stack">
      <section className="admin-card cs-pad cs-stack">
        <div className="cs-row cs-between">
          <button type="button" className="ad-btn cs-sm" onClick={onBack}>← 返回工單</button>
          <div className="cs-row">
            {c.website_issue ? <span className="ad-chip" data-tone="bad">網站問題{c.owner_notified_at ? ' · 已電郵通知' : ''}</span> : null}
            <span className="ad-chip" data-tone={c.status === 'resolved' ? undefined : c.status === 'pending' ? 'warn' : 'muted'}>{STATUS_LABEL[c.status]}</span>
            <span className="ad-chip" data-tone="muted">{CAT_LABEL[c.category]}</span>
          </div>
        </div>
        <h3>{c.subject}</h3>
        {c.detail ? <p className="cs-pre">{c.detail}</p> : null}
        {customer ? (
          <div className="cs-cust">
            <span className="cs-av">{(customer.displayName ?? customer.memberCode ?? '?').slice(0, 1).toUpperCase()}</span>
            <div className="cs-cust-text">
              <b>{customer.displayName ?? '（未有姓名）'}</b>
              <span className="ad-muted">{[customer.memberCode, customer.phone, customer.email].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
        ) : null}
        <div className="cs-meta">
          <span>建立 {hk(c.created_at)} · {c.created_by.split('@')[0]}</span>
          {c.booking_code ? <span>預約 <b className="ad-mono">{c.booking_code}</b></span> : null}
          {!customer ? <span className="cs-hint">未連結會員</span> : null}
        </div>
        {!customer ? (
          <div className="cs-stack">
            <span className="cs-lbl">連結會員（OTP、付款連結需要）</span>
            <CustomerPicker onPick={(cu) => void attach(cu)} />
          </div>
        ) : null}
        {loadErr ? <p className="cs-err">{loadErr}</p> : null}
        <div className="cs-row">
          <div className="cs-seg" role="group" aria-label="狀態">
            {(['open', 'pending', 'resolved'] as Status[]).map((st) => (
              <button key={st} type="button" className="cs-seg-btn" aria-pressed={c.status === st} disabled={busy || st === 'resolved'} onClick={() => void update({ status: st })}>{STATUS_LABEL[st]}</button>
            ))}
          </div>
          <button type="button" className="ad-btn cs-sm" disabled={busy} onClick={() => { setBusy(true); void api('POST', '', { action: 'auto_diagnose', caseId: id, force: true }).catch((e) => setLoadErr(msg(e))).finally(() => { setBusy(false); void load() }) }}>{busy ? '調查中…' : 'Spark 調查並電郵 Luca'}</button>
          {!c.website_issue ? <button type="button" className="ad-btn cs-sm" disabled={busy} onClick={() => void update({ websiteIssue: true, category: 'website' })}>標為網站問題（電郵通知我）</button> : null}
        </div>
        {c.status !== 'resolved' ? (
          <div className="cs-row">
            <input className="ad-input" value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="解決方法（會記錄在工單）" />
            <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => void update({ status: 'resolved', resolutionNote: resolution })}>標為已解決</button>
          </div>
        ) : c.resolution_note ? <p className="ad-muted">解決方法：{c.resolution_note}</p> : null}
      </section>

      <div className="cs-grid2">
        <OtpCard customer={customer} caseId={id} onDone={() => void load()} />
        <LinkCard customer={customer} caseId={id} link={link} setLink={setLink} onDone={() => void load()} />
      </div>
      <SparkCard caseId={id} onDone={() => void load()} />
      <TemplatePanel customer={customer} caseId={id} code={link?.humanCode ?? c.booking_code ?? ''} link={link?.phoneUrl ?? ''} templates={templates} onDone={() => void load()} />

      <section className="admin-card cs-pad cs-stack">
        <h3>時間線</h3>
        <div className="cs-row">
          <input className="ad-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="新增備註…" onKeyDown={(e) => { if (e.key === 'Enter') void addNote() }} />
          <button type="button" className="ad-btn" disabled={busy || !note.trim()} onClick={() => void addNote()}>新增</button>
        </div>
        <ol className="cs-timeline">
          {[...notes].reverse().map((n) => (
            <li key={n.id}>
              <div className="cs-row"><span className="ad-chip" data-tone="muted">{KIND_LABEL[n.kind] ?? n.kind}</span><span className="ad-muted">{hk(n.created_at)} · {n.author.split('@')[0]}</span></div>
              <p className="cs-pre">{n.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/* ── Templates tab ─────────────────────────────────────── */
function TemplatesTab({ templates, onSaved }: { templates: Template[]; onSaved: () => void }) {
  const [edit, setEdit] = useState<Template | null>(null)
  const [error, setError] = useState('')
  const blank: Template = { id: '', title: '', category: 'other', body: '' }
  const save = async () => {
    if (!edit) return
    try {
      await api('POST', '', { action: 'template_save', id: edit.id || undefined, title: edit.title, category: edit.category, body: edit.body })
      setEdit(null)
      setError('')
      onSaved()
    } catch (e) {
      setError(msg(e))
    }
  }
  const remove = async (t: Template) => {
    if (!window.confirm(`刪除範本「${t.title}」？`)) return
    try {
      await api('POST', '', { action: 'template_delete', id: t.id })
      onSaved()
    } catch (e) {
      setError(msg(e))
    }
  }
  return (
    <div className="cs-stack">
      <div className="cs-row"><button type="button" className="ad-btn ad-btn-primary" onClick={() => setEdit(blank)}>新增範本</button><span className="ad-muted">可用佔位符：{'{{name}} {{code}} {{link}} {{result}}'}</span></div>
      {edit ? (
        <section className="admin-card cs-pad cs-stack">
          <div className="cs-grid2">
            <label className="ad-field"><span>標題</span><input className="ad-input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="ad-field"><span>類別</span>
              <select className="ad-input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as Category })}>
                {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
              </select>
            </label>
          </div>
          <label className="ad-field"><span>內容</span><textarea className="ad-input cs-ta" rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          {error ? <p className="cs-err">{error}</p> : null}
          <div className="cs-row"><button type="button" className="ad-btn ad-btn-primary" disabled={!edit.title.trim() || !edit.body.trim()} onClick={() => void save()}>儲存</button><button type="button" className="ad-btn" onClick={() => setEdit(null)}>取消</button></div>
        </section>
      ) : null}
      <section className="admin-card">
        {templates.length === 0 ? <p className="ad-empty">暫時沒有範本</p> : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>標題</th><th>類別</th><th>內容</th><th /></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.title}</b></td>
                    <td><span className="ad-chip" data-tone="muted">{CAT_LABEL[t.category]}</span></td>
                    <td className="cs-pre cs-clip">{t.body}</td>
                    <td><div className="cs-row"><button type="button" className="ad-btn cs-sm" onClick={() => setEdit(t)}>編輯</button><button type="button" className="ad-btn cs-sm" onClick={() => void remove(t)}>刪除</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

/* ── Main ──────────────────────────────────────────────── */
export type CsView = 'cases' | 'verify' | 'link' | 'spark' | 'templates'

export default function CsCenter({ view = 'cases', initialCaseId }: { view?: CsView; initialCaseId?: string | null }) {
  const [filter, setFilter] = useState<'active' | Status>('active')
  const [q, setQ] = useState('')
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(initialCaseId ?? null)
  const [creating, setCreating] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [link, setLink] = useState<LinkResult | null>(null)

  const loadCases = useCallback(async () => {
    if (view !== 'cases') return
    setLoading(true)
    try {
      const d = await api('GET', `?view=cases&status=${filter}&q=${encodeURIComponent(q)}`)
      setCases(Array.isArray(d.cases) ? (d.cases as CaseRow[]) : [])
      setError('')
    } catch (e) {
      setError(msg(e))
    } finally {
      setLoading(false)
    }
  }, [filter, q, view])
  const loadTemplates = useCallback(async () => {
    try {
      const d = await api('GET', '?view=templates')
      setTemplates(Array.isArray(d.templates) ? (d.templates as Template[]) : [])
    } catch {
      setTemplates([])
    }
  }, [])
  useEffect(() => { void loadCases() }, [loadCases])
  useEffect(() => { void loadTemplates() }, [loadTemplates])

  const counts = useMemo(() => ({ website: cases.filter((x) => x.website_issue && x.status !== 'resolved').length }), [cases])
  const noop = () => undefined

  if (view === 'verify') return <WithCustomer>{(c) => <OtpCard customer={c} caseId={null} onDone={noop} />}</WithCustomer>
  if (view === 'link') return <WithCustomer>{(c) => <LinkCard customer={c} caseId={null} link={link} setLink={setLink} onDone={noop} />}</WithCustomer>
  if (view === 'spark') return <SparkCard caseId={null} onDone={noop} />
  if (view === 'templates') {
    return (
      <div className="cs-stack">
        <TemplatesTab templates={templates} onSaved={() => void loadTemplates()} />
        <WithCustomer>{(c) => <TemplatePanel customer={c} caseId={null} code="" link="" templates={templates} onDone={noop} />}</WithCustomer>
      </div>
    )
  }

  return (
    <div className="cs-stack">
      {creating ? (
        <NewCase onCreated={(id) => { setCreating(false); setOpenId(id); void loadCases() }} onCancel={() => setCreating(false)} />
      ) : openId ? (
        <CaseDetail id={openId} templates={templates} onBack={() => { setOpenId(null); void loadCases() }} onChanged={() => void loadCases()} />
      ) : (
        <section className="admin-card">
          <form className="ad-filters" onSubmit={(e) => { e.preventDefault(); void loadCases() }}>
            <label className="ad-field">
              <span>狀態</span>
              <select className="ad-input" value={filter} onChange={(e) => setFilter(e.target.value as 'active' | Status)}>
                <option value="active">未解決</option>
                <option value="open">處理中</option>
                <option value="pending">待跟進</option>
                <option value="resolved">已解決</option>
              </select>
            </label>
            <label className="ad-field">
              <span>搜尋</span>
              <input className="ad-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="標題、預約編號或客人電郵" />
            </label>
            <button type="submit" className="ad-btn">搜尋</button>
            <button type="button" className="ad-btn ad-btn-primary" onClick={() => setCreating(true)}>新工單</button>
          </form>
          {counts.website > 0 ? <p className="cs-banner">有 {counts.website} 張未解決的網站問題工單</p> : null}
          {error ? <p className="cs-err cs-pad">{error}</p> : null}
          <div className="ad-table-wrap" style={{ borderTop: '1px solid var(--admin-border-subtle)' }}>
            {loading ? <p className="ad-empty">載入中…</p> : cases.length === 0 ? <p className="ad-empty">沒有工單</p> : (
              <table className="ad-table">
                <thead><tr><th>時間</th><th>標題</th><th>類別</th><th>預約</th><th>狀態</th></tr></thead>
                <tbody>
                  {cases.map((x) => (
                    <tr key={x.id} className="cs-click" onClick={() => setOpenId(x.id)}>
                      <td className="ad-muted">{hk(x.created_at)}</td>
                      <td><b>{x.subject}</b></td>
                      <td><span className="ad-chip" data-tone={x.website_issue ? 'bad' : 'muted'}>{CAT_LABEL[x.category]}</span></td>
                      <td className="ad-mono">{x.booking_code ?? ''}</td>
                      <td><span className="ad-chip" data-tone={x.status === 'resolved' ? undefined : x.status === 'pending' ? 'warn' : 'muted'}>{STATUS_LABEL[x.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
