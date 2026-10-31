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

  const [memberCode, setMemberCode] = useState('')
  const [scenarioId, setScenarioId] = useState('smoking')
  const [amount, setAmount] = useState('500')
  const [detail, setDetail] = useState('')
  const [evidence, setEvidence] = useState('')
  const [bookingCode, setBookingCode] = useState('')
  const [blacklist, setBlacklist] = useState(true)
  const [confirmText, setConfirmText] = useState('')

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
    memberCode.trim().length >= 3 && detail.trim().length >= 5 && amount !== '' && Number.isFinite(amountNum) && amountNum >= 0 && confirmText.trim().toUpperCase() === memberCode.trim().toUpperCase()

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
      setConfirmText('')
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
      </div>

      {showForm && (
        <section className="flex flex-col gap-3 rounded-2xl p-4" style={{ border: '1px solid var(--admin-border)' }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              會員編號
              <input value={memberCode} onChange={(e) => setMemberCode(e.target.value)} placeholder="例如 S8-0001" className={field} style={fieldStyle} />
            </label>
            <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
              預約編號（選填）
              <input value={bookingCode} onChange={(e) => setBookingCode(e.target.value)} placeholder="該會員的預約碼" className={field} style={fieldStyle} />
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

          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            再次輸入會員編號確認發送
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className={field} style={fieldStyle} />
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
