'use client'

import { useCallback, useEffect, useState } from 'react'

// 會員 → 「違規個案」. Every mutation goes through /api/admin/cases*, which writes audit_log.
// Fees are collected by KPay hosted cashier (PaymentX) from the link in the notice email; a paid
// case closes itself. Waiving a fee is super_admin only (the API enforces it too).

type Scenario = {
  id: string
  label: string
  clause: string
  defaultAmount: number | null
  minChargeAmount: number
  applyBlacklistByDefault: boolean
  dueDays: number
  hint: string
}

type CaseView = {
  id: string
  case_no: string
  scenario: string
  title: string
  amount: number
  status: 'draft' | 'notified' | 'paid' | 'overdue' | 'waived' | 'cancelled'
  due_at: string | null
  paid_at: string | null
  apply_blacklist: boolean
  reminders_sent: number
  waived_reason: string | null
  is_test: boolean
  created_at: string
  needsReview: boolean
  payUrl: string
  whatsappDraft: string
  whatsappLink: string
  hasPhone: boolean
  member: { code: string | null; name: string | null; blacklisted: boolean } | null
}

type MemberHit = { code: string | null; name: string | null; phone: string | null; email: string | null; blacklisted: boolean }
type BookingHit = { code: string | null; date: string | null; start: string | null; end: string | null; status: string | null }

type Filter = 'open' | 'paid' | 'all'

const STATUS_LABEL: Record<CaseView['status'], string> = {
  draft: '未發送',
  notified: '待繳付',
  paid: '已繳付',
  overdue: '已逾期',
  waived: '已豁免',
  cancelled: '已取消',
}

const STATUS_COLOR: Record<CaseView['status'], string> = {
  draft: 'var(--admin-text-tertiary)',
  notified: 'var(--admin-text-primary)',
  paid: 'var(--admin-brand)',
  overdue: 'var(--admin-danger)',
  waived: 'var(--admin-text-tertiary)',
  cancelled: 'var(--admin-text-tertiary)',
}

const hkDate = (iso: string | null): string =>
  iso ? new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric' }).format(new Date(iso)) : '—'

const escapeHtml = (v: string): string => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Print-ready A4 letter page: Space8 logo header + a faint logo watermark on every page.
// The text is the (edited) textarea content, escaped; nothing is sent anywhere.
function letterHtml(text: string, caseNo: string, headerLogo: string, watermarkLogo: string, autoPrint: boolean): string {
  const body = text
    .split('\n\n')
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('')
  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>追討信 ${escapeHtml(caseNo)}</title>
<style>
  @page { size: A4; margin: 22mm 20mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #212630; font-family: -apple-system, 'Noto Sans HK', 'PingFang HK', 'Microsoft JhengHei', sans-serif; font-size: 11.5pt; line-height: 1.75; }
  body { max-width: 170mm; margin: 0 auto; padding: 8mm 4mm; }
  .wm { position: fixed; top: 50%; left: 50%; width: 120mm; height: 120mm; margin: -60mm 0 0 -60mm; opacity: 0.06; z-index: 0; }
  .page { position: relative; z-index: 1; }
  .head { padding-bottom: 8mm; margin-bottom: 8mm; border-bottom: 1px solid #d5d8de; }
  .head img { height: 12mm; }
  p { margin: 0 0 4.5mm; word-break: break-word; }
  @media print { body { max-width: none; padding: 0; } }
</style></head><body>
<img class="wm" src="${watermarkLogo}" alt="" />
<div class="page"><div class="head"><img src="${headerLogo}" alt="Space8" /></div>${body}</div>
${autoPrint ? `<script>window.addEventListener('load', function () { setTimeout(function () { window.print() }, 300) })</script>` : ''}
</body></html>`
}

function printLetter(text: string, caseNo: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  const origin = window.location.origin
  w.document.write(letterHtml(text, caseNo, `${origin}/logos/logo-black-horizontal.svg`, `${origin}/logos/logo-black-square.svg`, true))
  w.document.close()
  return true
}

async function toDataUri(path: string): Promise<string> {
  const svg = await (await fetch(path)).text()
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

// A self-contained .html file (logos inlined): opens anywhere and prints to PDF from any browser.
async function downloadLetter(text: string, caseNo: string): Promise<void> {
  const [header, mark] = await Promise.all([toDataUri('/logos/logo-black-horizontal.svg'), toDataUri('/logos/logo-black-square.svg')])
  const blob = new Blob([letterHtml(text, caseNo, header, mark, false)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `追討信-${caseNo}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const field = 'rounded-xl px-3 py-2 text-sm outline-none'
const fieldStyle = { border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)' } as const

export default function CasesManager() {
  const [filter, setFilter] = useState<Filter>('open')
  const [cases, setCases] = useState<CaseView[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [canWaive, setCanWaive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [letter, setLetter] = useState<{ id: string; text: string; termsOnRecord: boolean } | null>(null)

  const [memberCode, setMemberCode] = useState('')
  const [scenarioId, setScenarioId] = useState('smoking')
  const [amount, setAmount] = useState('500')
  const [detail, setDetail] = useState('')
  const [evidence, setEvidence] = useState('')
  const [bookingCode, setBookingCode] = useState('')
  const [blacklist, setBlacklist] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberHits, setMemberHits] = useState<MemberHit[]>([])
  const [picked, setPicked] = useState<MemberHit | null>(null)
  const [memberBookings, setMemberBookings] = useState<BookingHit[]>([])

  const scenario = scenarios.find((s) => s.id === scenarioId)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/cases?status=${filter}`, { cache: 'no-store' })
      const json = (await res.json()) as { error?: string; cases?: CaseView[]; scenarios?: Scenario[]; canWaive?: boolean }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '個案載入失敗')
        return
      }
      setCases(json.cases ?? [])
      setScenarios(json.scenarios ?? [])
      setCanWaive(json.canWaive === true)
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '個案載入失敗')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = memberQuery.trim()
    if (picked || q.length < 2) {
      setMemberHits([])
      return
    }
    const t = setTimeout(() => {
      void fetch(`/api/admin/cases/lookup?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ members?: MemberHit[] }>)
        .then((j) => setMemberHits(j.members ?? []))
        .catch(() => setMemberHits([]))
    }, 250)
    return () => clearTimeout(t)
  }, [memberQuery, picked])

  function pickMember(m: MemberHit) {
    setPicked(m)
    setMemberCode(m.code ?? '')
    setMemberQuery('')
    setMemberHits([])
    setBookingCode('')
    setMemberBookings([])
    if (m.code) {
      void fetch(`/api/admin/cases/lookup?code=${encodeURIComponent(m.code)}`, { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ bookings?: BookingHit[] }>)
        .then((j) => setMemberBookings(j.bookings ?? []))
        .catch(() => setMemberBookings([]))
    }
  }

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  function pickScenario(id: string) {
    setScenarioId(id)
    const s = scenarios.find((x) => x.id === id)
    if (!s) return
    setAmount(s.defaultAmount !== null ? String(s.defaultAmount) : '')
    setBlacklist(s.applyBlacklistByDefault)
  }

  async function post(url: string, body: Record<string, unknown>, ok: string): Promise<boolean> {
    setBusy(true)
    setFailure(null)
    setNotice(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = (await res.json()) as { error?: string }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '操作失敗')
        return false
      }
      setNotice(ok)
      await load()
      return true
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '操作失敗')
      return false
    } finally {
      setBusy(false)
    }
  }

  const amountNum = Number(amount)
  const formReady =
    memberCode.trim().length >= 3 && detail.trim().length >= 5 && amount !== '' && Number.isFinite(amountNum) && amountNum >= 0 && confirmed

  async function submit() {
    const ok = await post(
      '/api/admin/cases',
      { memberCode: memberCode.trim(), scenario: scenarioId, amount: amountNum, detail: detail.trim(), evidenceNote: evidence.trim(), bookingCode: bookingCode.trim(), applyBlacklist: blacklist },
      amountNum === 0 ? '警告已發送' : blacklist ? '個案已建立並發送，會員已加入黑名單' : '個案已建立並發送付款連結',
    )
    if (ok) {
      setMemberCode('')
      setDetail('')
      setEvidence('')
      setBookingCode('')
      setConfirmed(false)
      setPicked(null)
      setMemberBookings([])
      setShowForm(false)
    }
  }

  function ask(message: string): string | null {
    const v = window.prompt(message)
    return v && v.trim().length >= 5 ? v.trim() : null
  }

  return (
    <div className="flex flex-col gap-5">
      {(failure || notice) && (
        <div
          role={failure ? 'alert' : 'status'}
          className="rounded-xl px-4 py-3 text-sm"
          style={{ border: `1px solid ${failure ? 'var(--admin-danger)' : 'var(--admin-brand)'}`, color: failure ? 'var(--admin-danger)' : 'var(--admin-brand)' }}
        >
          {failure ?? notice}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['open', 'paid', 'all'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-xl px-3 py-1.5 text-sm"
              style={{ border: `1px solid ${filter === f ? 'var(--admin-brand)' : 'var(--admin-border)'}`, color: filter === f ? 'var(--admin-brand)' : 'var(--admin-text-primary)' }}
            >
              {f === 'open' ? '待處理' : f === 'paid' ? '已繳付' : '全部'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)' }}
        >
          {showForm ? '收起' : '新增個案'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm('會向你自己的帳戶 email 發送一個 HK$1.5 測試個案，用來試通知及付款流程。繼續？')) void post('/api/admin/cases', { selfTest: true }, '測試個案已建立，請查收 email')
          }}
          className="rounded-xl px-4 py-2 text-sm"
          style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
        >
          建立測試個案
        </button>
      </div>

      {showForm && (
        <section className="flex flex-col gap-3 rounded-2xl p-4" style={{ border: '1px solid var(--admin-border)' }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              會員（搜尋姓名、電話、email 或會員編號）
              {picked ? (
                <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm" style={{ border: '1px solid var(--admin-brand)', color: 'var(--admin-text-primary)' }}>
                  <span>
                    {picked.code}
                    {picked.name ? `（${picked.name}）` : ''}
                    {picked.blacklisted ? ' · 黑名單中' : ''}
                  </span>
                  <button type="button" onClick={() => { setPicked(null); setMemberCode(''); setMemberBookings([]); setBookingCode('') }} className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                    更換
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="例如 陳大文 / 9123 / S8-0001" className={`${field} w-full`} style={fieldStyle} />
                  {memberHits.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl text-sm" style={{ border: '1px solid var(--admin-border)', background: 'var(--admin-surface, #fff)' }}>
                      {memberHits.map((m) => (
                        <li key={m.code ?? m.email ?? m.phone}>
                          <button type="button" onClick={() => pickMember(m)} className="block w-full px-3 py-2 text-left" style={{ color: 'var(--admin-text-primary)' }}>
                            {m.code} {m.name ?? ''} <span className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>{m.phone ?? m.email ?? ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              相關預約（選填）
              <select value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} disabled={memberBookings.length === 0} className={field} style={fieldStyle}>
                <option value="">{picked ? (memberBookings.length ? '不指定' : '此會員沒有預約') : '先選擇會員'}</option>
                {memberBookings.map((b) => (
                  <option key={b.code} value={b.code ?? ''}>
                    {b.code} · {b.date ?? ''} {b.start?.slice(0, 5) ?? ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              違規情境
              <select value={scenarioId} onChange={(e) => pickScenario(e.target.value)} className={field} style={fieldStyle}>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}（{s.clause}）
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              費用 HK$（僅警告填 0）
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={field} style={fieldStyle} />
            </label>
          </div>
          {scenario && <p className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>{scenario.hint}（繳付期限 {scenario.dueDays} 日）</p>}

          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            違規事實（會寫入給會員的通知，至少 5 個字）
            <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className={field} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            內部證據備註（不會發給會員，例如 CCTV 時段、相片位置）
            <input value={evidence} onChange={(e) => setEvidence(e.target.value)} className={field} style={fieldStyle} />
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--admin-text-primary)' }}>
            <input type="checkbox" checked={blacklist} onChange={(e) => setBlacklist(e.target.checked)} />
            同時將會員加入黑名單（不能再預約）
          </label>

          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--admin-text-primary)' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            我已核對會員及違規事實，確認發送
          </label>
          <button
            type="button"
            disabled={busy || !formReady}
            onClick={() => void submit()}
            className="self-start rounded-xl px-4 py-2 text-sm font-medium"
            style={{ border: '1px solid var(--admin-danger)', color: 'var(--admin-danger)', opacity: busy || !formReady ? 0.5 : 1 }}
          >
            {busy ? '處理中…' : amountNum === 0 ? '發送警告' : '建立並發送付款連結'}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-busy={loading}>
        {!loading && cases.length === 0 && (
          <p className="rounded-xl px-4 py-6 text-center text-sm" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-tertiary)' }}>
            沒有個案
          </p>
        )}
        {cases.map((c) => (
          <article key={c.id} className="flex flex-col gap-2 rounded-2xl p-4" style={{ border: '1px solid var(--admin-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium" style={{ color: 'var(--admin-text-primary)' }}>
                {c.case_no}
                <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>{c.title}</span>
                {c.is_test && <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>測試</span>}
              </div>
              <span className="text-xs font-medium" style={{ color: STATUS_COLOR[c.status] }}>{STATUS_LABEL[c.status]}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              <span>會員 {c.member?.code ?? '—'}{c.member?.name ? `（${c.member.name}）` : ''}</span>
              <span>{c.amount === 0 ? '警告' : `HK$${c.amount.toLocaleString('en-US')}`}</span>
              <span>期限 {hkDate(c.due_at)}</span>
              {c.paid_at && <span>已繳 {hkDate(c.paid_at)}</span>}
              {c.member?.blacklisted && <span style={{ color: 'var(--admin-danger)' }}>黑名單中</span>}
              {c.waived_reason && <span>原因：{c.waived_reason}</span>}
            </div>
            {c.needsReview && (
              <p className="text-xs" style={{ color: 'var(--admin-danger)' }} role="alert">
                有款項待核對：KPay 已收款但個案未能入帳（重複付款、已豁免或金額不符）。請到 KPay 後台確認，需要時人手退款。
              </p>
            )}
            {letter?.id === c.id && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={letter.text}
                  onChange={(e) => setLetter({ ...letter, text: e.target.value })}
                  rows={14}
                  className={`${field} w-full`}
                  style={fieldStyle}
                  aria-label="追討信草稿"
                />
                {!letter.termsOnRecord && (
                  <p className="text-xs" style={{ color: 'var(--admin-danger)' }} role="alert">
                    此會員未有「同意條款」記錄（記錄功能啟用前的預約），信內未有同意時間。如有舊的付款或預約紀錄，建議補充說明。
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                  草稿不會自動發送。請填寫【】內資料，建議先由律師審閱一次範本；之後自行以電郵、WhatsApp 或掛號信寄出。
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void navigator.clipboard.writeText(letter.text).then(() => setNotice('已複製追討信'))} className="rounded-xl px-3 py-1.5 text-xs" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
                    複製全文
                  </button>
                  <button type="button" onClick={() => printLetter(letter.text, c.case_no)} className="rounded-xl px-3 py-1.5 text-xs" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
                    列印／存為 PDF
                  </button>
                  <button type="button" onClick={() => void downloadLetter(letter.text, c.case_no).then(() => setNotice('已下載追討信'))} className="rounded-xl px-3 py-1.5 text-xs" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
                    下載
                  </button>
                  <button type="button" onClick={() => setLetter(null)} className="rounded-xl px-3 py-1.5 text-xs" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-tertiary)' }}>
                    關閉
                  </button>
                </div>
              </div>
            )}
            {(c.status === 'draft' || c.status === 'notified' || c.status === 'overdue') && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={busy} onClick={() => void post(`/api/admin/cases/${c.id}`, { action: 'resend' }, '已重新發送通知')} className="rounded-xl px-3 py-1.5 text-xs" style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}>
                  重發通知
                </button>
                {c.amount > 0 && (
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(c.payUrl).then(() => setNotice('已複製付款連結'))}
                    className="rounded-xl px-3 py-1.5 text-xs"
                    style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                  >
                    複製付款連結
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(c.whatsappDraft).catch(() => undefined)
                    if (c.hasPhone) window.open(c.whatsappLink, '_blank', 'noopener,noreferrer')
                    setNotice(c.hasPhone ? '已複製 WhatsApp 草稿，並開啟對話' : '已複製 WhatsApp 草稿（此會員未有電話號碼）')
                  }}
                  className="rounded-xl px-3 py-1.5 text-xs"
                  style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                >
                  WhatsApp 草稿
                </button>
                {c.amount > 0 && c.status !== 'draft' && (
                  <button
                    type="button"
                    onClick={() => {
                      void fetch(`/api/admin/cases/${c.id}`)
                        .then((r) => r.json() as Promise<{ letter?: string; termsOnRecord?: boolean; error?: string }>)
                        .then((j) => {
                          if (j.letter) setLetter({ id: c.id, text: j.letter, termsOnRecord: j.termsOnRecord === true })
                          else setFailure(j.error ?? '未能草擬追討信')
                        })
                        .catch(() => setFailure('未能草擬追討信'))
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs"
                    style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                  >
                    追討信草稿
                  </button>
                )}
                {canWaive && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const reason = ask('豁免原因（至少 5 個字，會記入審計日誌）')
                      if (reason) void post(`/api/admin/cases/${c.id}`, { action: 'waive', reason }, '已豁免')
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs"
                    style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)' }}
                  >
                    豁免
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const reason = ask('取消原因（例如：開錯案，至少 5 個字）')
                    if (reason) void post(`/api/admin/cases/${c.id}`, { action: 'cancel', reason }, '已取消個案')
                  }}
                  className="rounded-xl px-3 py-1.5 text-xs"
                  style={{ border: '1px solid var(--admin-danger)', color: 'var(--admin-danger)' }}
                >
                  取消個案
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
