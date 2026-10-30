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
  identity_verified_at: string | null
  identity_skipped_at: string | null
  spark_verdict: Verdict | null
  created_by: string
  resolution_note: string | null
}
type Verdict = { type: string; website: string; action: string }
const VERDICT_TYPE: Record<string, string> = { user_error: '客人操作問題', payment_unconfirmed: '已付款未確認', payment_failed: '付款失敗', website_bug: '網站 bug', slot_conflict: '時段衝突', account: '帳戶問題', unknown: '未能確定' }
const VERDICT_ACTION: Record<string, string> = { payment_link: '生成付款連結', check_payment: '核實付款', review_booking: '檢查預約', reply_only: '直接回覆客人', escalate: '交俾 Luca 跟進' }
type Prefill = { id: string; humanCode: string; date: string; startHour: number; duration: number; table: number; status: string; amount: number }
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
  const [paste, setPaste] = useState('')
  const [sparkBusy, setSparkBusy] = useState(false)
  const [sparkNote, setSparkNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Spark turns the customer's own words into category / title / detail / booking code.
  const organise = async () => {
    setSparkBusy(true)
    setSparkNote('')
    try {
      const d = await api('POST', '', { action: 'spark_triage', text: paste })
      if (typeof d.category === 'string' && d.category in CAT_LABEL) setCategory(d.category as Category)
      if (typeof d.subject === 'string') setSubject(d.subject)
      if (typeof d.detail === 'string') setDetail(d.detail)
      if (typeof d.bookingCode === 'string' && d.bookingCode) setBookingCode(d.bookingCode)
      setSparkNote('Spark 已整理，請檢查後再建立工單')
    } catch (e) {
      setSparkNote(msg(e))
    } finally {
      setSparkBusy(false)
    }
  }

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
      <h3>新工單 · 第 1 步：收單</h3>
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
      <div className="cs-spark-box cs-stack">
        <span className="cs-lbl">貼上客人原話，Spark 幫你整理（電郵、電話會先遮蓋，不會傳給 AI）</span>
        <textarea className="ad-input cs-ta" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="例如：我今朝付咗錢但係冇收到確認電郵，預約編號 SPACE8-…" />
        <div className="cs-row">
          <button type="button" className="ad-btn" disabled={sparkBusy || paste.trim().length < 5} onClick={() => void organise()}>{sparkBusy ? 'Spark 整理中…' : 'Spark 整理'}</button>
          {sparkNote ? <span className="cs-hint">{sparkNote}</span> : null}
        </div>
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
      <p className="cs-hint">建立後 Spark 會自動查客人帳戶紀錄同 Vercel 日誌，並把調查報告電郵俾 Luca。{category === 'website' ? '網站問題會即時再通知一次。' : ''}</p>
      {error ? <p className="cs-err">{error}</p> : null}
      <div className="cs-row">
        <button type="button" className="ad-btn ad-btn-primary" disabled={busy || subject.trim().length < 3} onClick={() => void submit()}>{busy ? '建立中…' : '建立工單，開始流程'}</button>
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

function LinkCard({ customer, caseId, link, setLink, prefill, onDone }: { customer: Customer | null; caseId: string | null; link: LinkResult | null; setLink: (l: LinkResult | null) => void; prefill?: Prefill | null; onDone: () => void }) {
  const [date, setDate] = useState('')
  const [startHour, setStartHour] = useState('')
  const [endHour, setEndHour] = useState('')
  const [table, setTable] = useState('1')
  const [price, setPrice] = useState('')
  const [standard, setStandard] = useState<number | null>(null)
  const [quoteNote, setQuoteNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkMsg, setLinkMsg] = useState('')
  const customerId = customer?.id ?? null
  const duration = startHour !== '' && endHour !== '' ? Number(endHour) - Number(startHour) : 0
  const hh = (h: string | number) => `${String(h).padStart(2, '0')}:00`
  useEffect(() => {
    setStandard(null)
    setQuoteNote('')
    if (!customerId || !date || startHour === '' || duration < 1) return
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
        summary: `${date} ${hh(startHour)}–${hh(endHour)}（${duration} 小時）房${table}`,
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
      {prefill ? (
        <div className="cs-row">
          <button type="button" className="ad-btn cs-sm" onClick={() => { setDate(prefill.date); setStartHour(String(prefill.startHour)); setEndHour(String(prefill.startHour + prefill.duration)); setTable(String(prefill.table)) }}>按原預約 {prefill.humanCode} 預填（{prefill.date} {String(prefill.startHour).padStart(2, '0')}:00 · {prefill.duration} 小時 · 房{prefill.table}）</button>
          {prefill.status === 'confirmed' ? <span className="cs-hint">原預約已確認，同一時段會衝突</span> : null}
        </div>
      ) : null}
      <div className="cs-form">
        <label className="ad-field cs-span"><span>日期</span><input className="ad-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="ad-field"><span>由</span>
          <select className="ad-input" value={startHour} onChange={(e) => { setStartHour(e.target.value); if (endHour !== '' && Number(endHour) <= Number(e.target.value)) setEndHour('') }}>
            <option value="">選擇</option>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}</option>)}
          </select>
        </label>
        <label className="ad-field"><span>至</span>
          <select className="ad-input" value={endHour} disabled={startHour === ''} onChange={(e) => setEndHour(e.target.value)}>
            <option value="">選擇</option>
            {Array.from({ length: 24 }, (_, i) => i + 1).filter((h) => startHour === '' || (h > Number(startHour) && h - Number(startHour) <= 8)).map((h) => <option key={h} value={h}>{hh(h)}</option>)}
          </select>
        </label>
        <label className="ad-field"><span>房間</span>
          <select className="ad-input" value={table} onChange={(e) => setTable(e.target.value)}><option value="1">房 1</option><option value="2">房 2</option></select>
        </label>
      </div>
      <div className="cs-price">
        <div className="cs-price-std">
          <span className="cs-lbl">{duration > 0 ? `${hh(startHour)} – ${hh(endHour)} · 共 ${duration} 小時 · 標準價` : '標準價（按會員等級計算）'}</span>
          <b>{standard !== null ? `HK$${standard}` : '—'}</b>
        </div>
        <label className="ad-field">
          <span>自訂價錢（HK$，留空 = 用標準價）</span>
          <input className="ad-input" type="number" min={1.5} max={5000} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={standard !== null ? String(standard) : '例如 200'} />
        </label>
        {quoteNote ? <p className="cs-hint">{quoteNote}</p> : null}
        {price.trim() !== '' && standard !== null && Number(price) !== standard ? <p className="cs-hint">會以 HK${Number(price) || 0} 收費，並記錄為自訂價錢（標準價 HK${standard}）。</p> : null}
      </div>
      <button type="button" className="ad-btn ad-btn-primary" disabled={!customer || busy || !date || duration < 1} onClick={() => void create()}>{busy ? '處理中…' : '生成付款連結'}</button>
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

/* ── Workflow ──────────────────────────────────────────── */
type StepId = 'intake' | 'verify' | 'diagnose' | 'handle' | 'reply' | 'close'
const STEPS: { id: StepId; label: string }[] = [
  { id: 'intake', label: '收單' },
  { id: 'verify', label: '核對' },
  { id: 'diagnose', label: '診斷' },
  { id: 'handle', label: '處理' },
  { id: 'reply', label: '回覆' },
  { id: 'close', label: '結案' },
]

function StepNav({ step, onGo, nextLabel }: { step: StepId; onGo: (s: StepId) => void; nextLabel?: string }) {
  const i = STEPS.findIndex((x) => x.id === step)
  return (
    <div className="cs-row cs-between cs-stepnav">
      {i > 0 ? <button type="button" className="ad-btn" onClick={() => onGo(STEPS[i - 1].id)}>← {STEPS[i - 1].label}</button> : <span />}
      {i < STEPS.length - 1 ? <button type="button" className="ad-btn ad-btn-primary" onClick={() => onGo(STEPS[i + 1].id)}>{nextLabel ?? `完成，下一步：${STEPS[i + 1].label}`} →</button> : null}
    </div>
  )
}

function VerdictRow({ v }: { v: Verdict | null }) {
  if (!v) return null
  return (
    <div className="cs-row">
      <span className="ad-chip" data-tone={v.type === 'website_bug' ? 'bad' : 'muted'}>{VERDICT_TYPE[v.type] ?? v.type}</span>
      <span className="ad-chip" data-tone={v.website === 'yes' ? 'bad' : 'muted'}>網站問題：{v.website === 'yes' ? '是' : v.website === 'no' ? '否' : '未能確定'}</span>
      <span className="ad-chip" data-tone="warn">Spark 建議：{VERDICT_ACTION[v.action] ?? v.action}</span>
    </div>
  )
}

function DiagnosePanel({ c, notes, onGo, onDone }: { c: CaseRow; notes: Note[]; onGo: (s: StepId) => void; onDone: () => void }) {
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState<'' | 'diagnose' | 'email'>('')
  const [err, setErr] = useState('')
  const [tools, setTools] = useState<string[]>([])
  const report = [...notes].reverse().find((n) => n.kind === 'spark')
  const young = Date.now() - new Date(c.created_at).getTime() < 4 * 60_000
  const waiting = !c.auto_report_at && !report && young
  const run = async () => {
    setBusy('diagnose')
    setErr('')
    try {
      const d = await api('POST', '', { action: 'spark_diagnose', caseId: c.id, extra })
      setTools(Array.isArray(d.steps) ? (d.steps as { tool: string }[]).map((x) => x.tool) : [])
      setExtra('')
      onDone()
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy('')
    }
  }
  const emailOwner = async () => {
    setBusy('email')
    setErr('')
    try {
      await api('POST', '', { action: 'auto_diagnose', caseId: c.id, force: true })
      onDone()
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy('')
    }
  }
  const v = c.spark_verdict
  const goFor = (a: string): StepId => (a === 'reply_only' ? 'reply' : 'handle')
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>第 3 步：Spark 診斷</h3>
      <p className="ad-muted">Spark 會查客人帳戶紀錄、付款時間線、KPay 狀態、Vercel 日誌同資料庫（只讀，唔會改任何資料）。</p>
      {waiting ? <p className="cs-hint cs-pulse">Spark 正在自動調查，完成後會顯示喺呢度並電郵俾 Luca…</p> : null}
      <VerdictRow v={v} />
      {report ? <div className="cs-ai"><Markdown text={report.body.replace(/^【自動調查】\n?/, '')} /><span className="ad-muted">{hk(report.created_at)}</span></div> : !waiting ? <p className="ad-muted">未有調查結果，撳「Spark 診斷」開始。</p> : null}
      {v && v.action !== 'escalate' ? (
        <button type="button" className="ad-btn ad-btn-primary" onClick={() => onGo(goFor(v.action))}>按 Spark 建議：{VERDICT_ACTION[v.action] ?? v.action} →</button>
      ) : v ? <p className="cs-hint">Spark 建議交俾 Luca 跟進。可撳「電郵 Luca」再發一次報告。</p> : null}
      <label className="ad-field"><span>補充資料（選填）</span>
        <textarea className="ad-input cs-ta" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="例如客人話咩時間、點付款、見到咩錯誤" />
      </label>
      <div className="cs-row">
        <button type="button" className="ad-btn" disabled={busy !== ''} onClick={() => void run()}>{busy === 'diagnose' ? 'Spark 調查中…' : report ? '重新診斷' : 'Spark 診斷'}</button>
        <button type="button" className="ad-btn" disabled={busy !== ''} onClick={() => void emailOwner()}>{busy === 'email' ? '調查並發送中…' : '調查並電郵 Luca'}</button>
      </div>
      {tools.length > 0 ? <p className="ad-muted">今次查了：{tools.join('、')}</p> : null}
      {err ? <p className="cs-err">{err}</p> : null}
      <StepNav step="diagnose" onGo={onGo} />
    </section>
  )
}

function HandlePanel({ c, customer, link, setLink, onGo, onDone }: { c: CaseRow; customer: Customer | null; link: LinkResult | null; setLink: (l: LinkResult | null) => void; onGo: (s: StepId) => void; onDone: () => void }) {
  const v = c.spark_verdict
  const initial = v?.action === 'check_payment' ? 'payment' : v?.action === 'payment_link' ? 'link' : v?.action === 'review_booking' ? 'other' : 'link'
  const [mode, setMode] = useState<'link' | 'payment' | 'other'>(initial)
  const [prefill, setPrefill] = useState<Prefill | null>(null)
  useEffect(() => {
    if (!c.booking_code) return
    void api('POST', '', { action: 'booking_for_case', caseId: c.id })
      .then((d) => setPrefill(isRecord(d.booking) ? (d.booking as unknown as Prefill) : null))
      .catch(() => setPrefill(null))
  }, [c.id, c.booking_code])
  const verified = !!c.identity_verified_at
  return (
    <div className="cs-stack">
      <section className="admin-card cs-pad cs-stack">
        <h3>第 4 步：處理</h3>
        {v ? <p className="cs-hint">Spark 建議：{VERDICT_ACTION[v.action] ?? v.action}（{VERDICT_TYPE[v.type] ?? v.type}）</p> : <p className="ad-muted">未有 Spark 判斷，可先返回上一步診斷。</p>}
        <div className="cs-seg" role="group" aria-label="處理方式">
          {([['link', '網站付唔到 · 付款連結'], ['payment', '已付款未確認'], ['other', '改期／取消／其他']] as const).map(([k, label]) => (
            <button key={k} type="button" className="cs-seg-btn" aria-pressed={mode === k} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        {mode === 'payment' ? (
          <div className="cs-stack">
            <p className="ad-muted">客人話已付款但預約未確認：到付款記錄核實 KPay 狀態，需要時人手確認或審核。</p>
            <div className="cs-row">
              {prefill ? <a className="ad-btn" href={`/admin/bookings/${prefill.id}`}>打開預約 {prefill.humanCode}（付款經過）</a> : null}
              <a className="ad-btn" href="/admin/payment-log">付款記錄</a>
              <a className="ad-btn" href="/admin/payment-system">付款系統</a>
            </div>
            {prefill ? <p className="cs-hint">預約狀態：{prefill.status} · HK${prefill.amount}</p> : null}
          </div>
        ) : null}
        {mode === 'other' ? (
          <div className="cs-stack">
            <p className="ad-muted">改期、取消或查看預約細節，到預約頁處理。處理完請返嚟記錄。</p>
            <div className="cs-row">
              {prefill ? <a className="ad-btn" href={`/admin/bookings/${prefill.id}`}>打開預約 {prefill.humanCode}</a> : null}
              <a className="ad-btn" href="/admin/bookings">預約列表</a>
            </div>
          </div>
        ) : null}
      </section>
      {mode === 'link' ? (
        verified ? (
          <LinkCard customer={customer} caseId={c.id} link={link} setLink={setLink} prefill={prefill} onDone={onDone} />
        ) : (
          <section className="admin-card cs-pad cs-stack">
            <h3>全託管付款連結</h3>
            <p className="cs-hint">為免有人冒認，生成付款連結前必須先完成電郵驗證碼核對。</p>
            <div><button type="button" className="ad-btn ad-btn-primary" onClick={() => onGo('verify')}>去核對身份</button></div>
          </section>
        )
      ) : null}
      <section className="admin-card cs-pad"><StepNav step="handle" onGo={onGo} /></section>
    </div>
  )
}

function ReplyPanel({ c, customer, link, templates, onGo, onDone }: { c: CaseRow; customer: Customer | null; link: LinkResult | null; templates: Template[]; onGo: (s: StepId) => void; onDone: () => void }) {
  const [extra, setExtra] = useState('')
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const draftIt = async () => {
    setBusy(true)
    setErr('')
    try {
      const d = await api('POST', '', { action: 'spark_reply', caseId: c.id, extra, code: link?.humanCode ?? c.booking_code ?? '', link: link?.phoneUrl ?? '' })
      setDraft(String(d.text ?? ''))
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="cs-stack">
      <section className="admin-card cs-pad cs-stack">
        <h3>第 5 步：回覆客人</h3>
        <p className="ad-muted">Spark 會按調查結果同處理紀錄起草回覆（只用查到嘅事實）；你修改後複製，再記錄為已回覆。</p>
        <label className="ad-field"><span>想 Spark 特別提到嘅（選填）</span>
          <input className="ad-input" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="例如：已退款、請今晚前完成付款、道歉" />
        </label>
        <div className="cs-row"><button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => void draftIt()}>{busy ? 'Spark 起草中…' : draft ? 'Spark 重新起草' : 'Spark 起草回覆'}</button></div>
        {err ? <p className="cs-err">{err}</p> : null}
        {draft ? (
          <div className="cs-stack">
            <textarea className="ad-input cs-ta" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="cs-row">
              <CopyButton text={draft} />
              <button type="button" className="ad-btn" onClick={() => { void api('POST', '', { action: 'add_note', caseId: c.id, kind: 'reply', body: draft }).then(onDone) }}>記錄為已回覆</button>
            </div>
          </div>
        ) : null}
      </section>
      <TemplatePanel customer={customer} caseId={c.id} code={link?.humanCode ?? c.booking_code ?? ''} link={link?.phoneUrl ?? ''} templates={templates} onDone={onDone} />
      <section className="admin-card cs-pad"><StepNav step="reply" onGo={onGo} /></section>
    </div>
  )
}

function ClosePanel({ c, onGo, onDone }: { c: CaseRow; onGo: (s: StepId) => void; onDone: () => void }) {
  const [text, setText] = useState(c.resolution_note ?? '')
  const [busy, setBusy] = useState<'' | 'spark' | 'close'>('')
  const [err, setErr] = useState('')
  const draft = async () => {
    setBusy('spark')
    setErr('')
    try {
      const d = await api('POST', '', { action: 'spark_resolve', caseId: c.id })
      setText(String(d.text ?? ''))
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy('')
    }
  }
  const close = async () => {
    setBusy('close')
    setErr('')
    try {
      await api('POST', '', { action: 'update_case', caseId: c.id, status: 'resolved', resolutionNote: text })
      onDone()
    } catch (e) {
      setErr(msg(e))
    } finally {
      setBusy('')
    }
  }
  return (
    <section className="admin-card cs-pad cs-stack">
      <h3>第 6 步：結案</h3>
      {c.status === 'resolved' ? (
        <>
          <p className="cs-ok">工單已解決</p>
          {c.resolution_note ? <p className="cs-pre">解決方法：{c.resolution_note}</p> : null}
          <div><button type="button" className="ad-btn" onClick={() => { setBusy('close'); void api('POST', '', { action: 'update_case', caseId: c.id, status: 'open' }).then(onDone).finally(() => setBusy('')) }} disabled={busy !== ''}>重開工單</button></div>
        </>
      ) : (
        <>
          <p className="ad-muted">寫低解決方法（必填）。Spark 可以按整張工單嘅紀錄起草。</p>
          <textarea className="ad-input cs-ta" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="做咗咩、結果如何" />
          <div className="cs-row">
            <button type="button" className="ad-btn" disabled={busy !== ''} onClick={() => void draft()}>{busy === 'spark' ? 'Spark 起草中…' : 'Spark 起草解決方法'}</button>
            <button type="button" className="ad-btn ad-btn-primary" disabled={busy !== '' || text.trim().length < 3} onClick={() => void close()}>{busy === 'close' ? '處理中…' : '標為已解決'}</button>
          </div>
        </>
      )}
      {err ? <p className="cs-err">{err}</p> : null}
      <StepNav step="close" onGo={onGo} />
    </section>
  )
}

/* ── Case detail ───────────────────────────────────────── */
function CaseDetail({ id, templates, onBack, onChanged }: { id: string; templates: Template[]; onBack: () => void; onChanged: () => void }) {
  const [c, setC] = useState<CaseRow | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [step, setStep] = useState<StepId | null>(null)
  const [link, setLink] = useState<LinkResult | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

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

  const done: Record<StepId, boolean> = useMemo(() => ({
    intake: !!customer,
    verify: !!c?.identity_verified_at || !!c?.identity_skipped_at,
    diagnose: !!c?.auto_report_at || notes.some((n) => n.kind === 'spark'),
    handle: notes.some((n) => n.kind === 'payment_link'),
    reply: notes.some((n) => n.kind === 'reply'),
    close: c?.status === 'resolved',
  }), [c, customer, notes])

  // Open on the first unfinished step.
  useEffect(() => {
    if (step !== null || !c) return
    const first = STEPS.find((x) => !done[x.id])
    setStep(first ? first.id : 'close')
  }, [c, done, step])

  // While Spark's automatic investigation is running, refresh until the report lands.
  const waitingReport = !!c && !c.auto_report_at && Date.now() - new Date(c.created_at).getTime() < 4 * 60_000
  useEffect(() => {
    if (!waitingReport) return
    const t = setInterval(() => { void load() }, 6000)
    return () => clearInterval(t)
  }, [waitingReport, load])

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
  const refresh = () => { void load(); onChanged() }

  if (loadErr && !c) return <section className="admin-card cs-pad"><p className="cs-err">{loadErr}</p><button type="button" className="ad-btn" onClick={onBack}>返回</button></section>
  if (!c) return <section className="admin-card cs-pad"><p className="ad-muted">載入中…</p></section>
  const cur: StepId = step ?? 'intake'

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
        <ol className="cs-steps" aria-label="處理流程">
          {STEPS.map((st, i) => (
            <li key={st.id}>
              <button type="button" className="cs-step" data-active={cur === st.id} data-done={done[st.id]} onClick={() => setStep(st.id)}>
                <span className="cs-step-n">{done[st.id] ? '✓' : i + 1}</span>
                <span className="cs-step-l">{st.label}</span>
              </button>
            </li>
          ))}
        </ol>
        {loadErr ? <p className="cs-err">{loadErr}</p> : null}
      </section>

      {cur === 'intake' ? (
        <section className="admin-card cs-pad cs-stack">
          <h3>第 1 步：收單</h3>
          {c.detail ? <p className="cs-pre">{c.detail}</p> : null}
          {customer ? (
            <div className="cs-cust">
              <span className="cs-av">{(customer.displayName ?? customer.memberCode ?? '?').slice(0, 1).toUpperCase()}</span>
              <div className="cs-cust-text">
                <b>{customer.displayName ?? '（未有姓名）'}</b>
                <span className="ad-muted">{[customer.memberCode, customer.phone, customer.email].filter(Boolean).join(' · ')}</span>
              </div>
            </div>
          ) : (
            <div className="cs-stack">
              <span className="cs-lbl">連結會員（核對身份、付款連結需要）</span>
              <CustomerPicker onPick={(cu) => void attach(cu)} />
            </div>
          )}
          <div className="cs-meta">
            <span>建立 {hk(c.created_at)} · {c.created_by.split('@')[0]}</span>
            {c.booking_code ? <span>預約 <b className="ad-mono">{c.booking_code}</b></span> : null}
          </div>
          <div className="cs-row">
            <div className="cs-seg" role="group" aria-label="狀態">
              {(['open', 'pending'] as Status[]).map((st) => (
                <button key={st} type="button" className="cs-seg-btn" aria-pressed={c.status === st} disabled={busy || c.status === 'resolved'} onClick={() => void update({ status: st })}>{STATUS_LABEL[st]}</button>
              ))}
            </div>
            {!c.website_issue ? <button type="button" className="ad-btn cs-sm" disabled={busy} onClick={() => void update({ websiteIssue: true, category: 'website' })}>標為網站問題（電郵通知 Luca）</button> : null}
          </div>
          <StepNav step="intake" onGo={setStep} />
        </section>
      ) : null}

      {cur === 'verify' ? (
        <div className="cs-stack">
          {c.identity_verified_at ? <section className="admin-card cs-pad"><p className="cs-ok">身份已核對 · {hk(c.identity_verified_at)}</p></section> : null}
          {!c.identity_verified_at ? <OtpCard customer={customer} caseId={id} onDone={refresh} /> : null}
          {!c.identity_verified_at && !c.identity_skipped_at ? (
            <section className="admin-card cs-pad cs-stack">
              <p className="ad-muted">純查詢、唔涉及付款連結嘅工單可以略過核對（會記錄喺時間線）。付款連結一定要核對。</p>
              <div><button type="button" className="ad-btn" onClick={() => { void api('POST', '', { action: 'identity_skip', caseId: id }).then(() => { refresh(); setStep('diagnose') }) }}>略過核對</button></div>
            </section>
          ) : null}
          {c.identity_skipped_at && !c.identity_verified_at ? <section className="admin-card cs-pad"><p className="cs-hint">已略過核對 · {hk(c.identity_skipped_at)}（仍可隨時發驗證碼核對）</p></section> : null}
          <section className="admin-card cs-pad"><StepNav step="verify" onGo={setStep} /></section>
        </div>
      ) : null}

      {cur === 'diagnose' ? <DiagnosePanel c={c} notes={notes} onGo={setStep} onDone={refresh} /> : null}
      {cur === 'handle' ? <HandlePanel c={c} customer={customer} link={link} setLink={setLink} onGo={setStep} onDone={refresh} /> : null}
      {cur === 'reply' ? <ReplyPanel c={c} customer={customer} link={link} templates={templates} onGo={setStep} onDone={refresh} /> : null}
      {cur === 'close' ? <ClosePanel c={c} onGo={setStep} onDone={refresh} /> : null}

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
export type CsView = 'cases' | 'spark' | 'templates'

export default function CsCenter({ view = 'cases', initialCaseId }: { view?: CsView; initialCaseId?: string | null }) {
  const [filter, setFilter] = useState<'active' | Status>('active')
  const [q, setQ] = useState('')
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(initialCaseId ?? null)
  const [creating, setCreating] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
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
