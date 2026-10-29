'use client'

import { useCallback, useEffect, useState } from 'react'

// 後台 → 設定 → 支付系統. Which payment system (KPay / Stripe / PaymentX) customers use:
//  • public system: super_admin only, two-step confirmation (tick + type the system name);
//  • per-account override: any admin picks which account uses which system.
// Admin theme variables only.

type Sys = 'kpay' | 'stripe' | 'paymentx'
type Override = {
  userId: string
  system: Sys
  email: string | null
  displayName: string | null
  memberCode: string | null
  note: string | null
  addedBy: string | null
}
type Candidate = { userId: string; email: string | null; displayName: string | null; memberCode: string | null }
type Loaded = { publicSystem: Sys; updatedBy: string | null; updatedAt: string | null; canChangePublic: boolean; overrides: Override[] }

const NAME: Record<Sys, string> = { kpay: 'KPay', stripe: 'Stripe', paymentx: 'PaymentX' }
const DESC: Record<Sys, string> = {
  kpay: '直連 KPay（現行）',
  stripe: 'Stripe',
  paymentx: 'KPay 全托管收銀台 vX1.0.0',
}
const SYSTEMS: Sys[] = ['kpay', 'stripe', 'paymentx']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isSys(v: unknown): v is Sys {
  return v === 'kpay' || v === 'stripe' || v === 'paymentx'
}

const card = { borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' } as const
const muted = { color: 'var(--admin-text-tertiary)' } as const
const primary = { color: 'var(--admin-text-primary)' } as const

export default function PaymentSystemPanel() {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // public-switch confirmation
  const [target, setTarget] = useState<Sys | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [understood, setUnderstood] = useState(false)
  const [typed, setTyped] = useState('')

  // override add
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [addSystem, setAddSystem] = useState<Sys>('paymentx')
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-system', { cache: 'no-store' })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok || !isRecord(json)) {
        setError(isRecord(json) && typeof json.error === 'string' ? json.error : '載入失敗')
        return
      }
      setData(json as unknown as Loaded)
      setError(null)
    } catch {
      setError('載入失敗')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch('/api/admin/payment-system', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json: unknown = await res.json().catch(() => null)
    if (!res.ok || !isRecord(json)) {
      setError(isRecord(json) && typeof json.error === 'string' ? json.error : '操作失敗')
      return null
    }
    setError(null)
    return json
  }

  function openConfirm(s: Sys) {
    setTarget(s)
    setStep(1)
    setUnderstood(false)
    setTyped('')
    setMessage(null)
  }
  function closeConfirm() {
    setTarget(null)
    setStep(1)
    setUnderstood(false)
    setTyped('')
  }

  async function applyPublic() {
    if (!target) return
    setBusy('public')
    try {
      const json = await post({ action: 'set_public', system: target, confirmed: true, confirmText: typed })
      if (json) {
        setMessage(`已將公開支付系統切換為 ${NAME[target]}`)
        closeConfirm()
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  async function search() {
    if (query.trim().length < 2) return
    setBusy('search')
    try {
      const json = await post({ action: 'search', q: query })
      setResults(json && Array.isArray(json.users) ? (json.users as Candidate[]) : [])
    } finally {
      setBusy(null)
    }
  }

  async function setOverride(userId: string, system: Sys, withNote?: string) {
    setBusy(userId)
    try {
      if (await post({ action: 'set_override', userId, system, note: withNote })) {
        setResults([])
        setQuery('')
        setNote('')
        await load()
      }
    } finally {
      setBusy(null)
    }
  }

  async function removeOverride(userId: string) {
    setBusy(userId)
    try {
      if (await post({ action: 'remove_override', userId })) await load()
    } finally {
      setBusy(null)
    }
  }

  const current = data?.publicSystem ?? null
  const exists = (id: string) => data?.overrides.some((o) => o.userId === id) === true

  return (
    <section className="overflow-hidden rounded-[var(--admin-radius-card)] border" style={card}>
      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--admin-border-subtle)' }}>
        <h2 className="text-base font-semibold" style={primary}>
          支付系統
        </h2>
        {current && (
          <span
            className="rounded-[var(--admin-radius-pill)] border px-2.5 py-0.5 text-xs font-medium"
            style={{ borderColor: 'var(--admin-green)', color: 'var(--admin-green)' }}
          >
            公開：{NAME[current]}
          </span>
        )}
      </div>

      {error && (
        <p className="px-5 pt-3 text-sm" style={{ color: 'var(--admin-status-danger)' }}>
          {error}
        </p>
      )}
      {message && (
        <p className="px-5 pt-3 text-sm" style={{ color: 'var(--admin-green)' }}>
          {message}
        </p>
      )}

      {/* ── Public system ─────────────────────── */}
      <div className="px-5 pt-5">
        <h3 className="text-sm font-medium" style={primary}>
          所有客人用邊個系統
        </h3>
        <p className="mt-1 text-xs" style={muted}>
          {data?.canChangePublic
            ? '切換會即時影響所有未被單獨指定嘅客人。需要兩步確認。'
            : '只有 super admin 可以切換公開系統。你可以喺下面為個別帳戶指定系統。'}
          {data?.updatedBy ? `　最後更改：${data.updatedBy}` : ''}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {SYSTEMS.map((s) => {
            const active = current === s
            return (
              <button
                key={s}
                type="button"
                disabled={active || !data?.canChangePublic || busy !== null}
                onClick={() => openConfirm(s)}
                className="rounded-[var(--admin-radius-card)] border px-3 py-3 text-left text-sm"
                style={{
                  borderColor: active ? 'var(--admin-green)' : 'var(--admin-border-subtle)',
                  background: 'var(--admin-bg-surface)',
                  opacity: !active && !data?.canChangePublic ? 0.5 : 1,
                  ...primary,
                }}
              >
                <span className="block font-medium">
                  {NAME[s]} {active ? '（使用中）' : ''}
                </span>
                <span className="block text-xs" style={muted}>
                  {DESC[s]}
                </span>
              </button>
            )
          })}
        </div>

        {target && current && (
          <div className="mt-4 rounded-[var(--admin-radius-card)] border p-4" style={{ borderColor: 'var(--admin-status-danger)' }}>
            {step === 1 ? (
              <>
                <p className="text-sm font-medium" style={primary}>
                  第 1 步：確認切換
                </p>
                <p className="mt-1 text-xs" style={muted}>
                  所有客人嘅付款會由 <b>{NAME[current]}</b> 轉去 <b>{NAME[target]}</b>。已經喺舊系統開咗而未付嘅單，之後付款仍然會由系統自動處理。
                </p>
                <label className="mt-3 flex items-center gap-2 text-sm" style={primary}>
                  <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                  我明白呢個更改會即時影響所有客人
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={!understood}
                    onClick={() => setStep(2)}
                    className="rounded-[var(--admin-radius-pill)] px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'var(--admin-green)', color: 'var(--admin-brand-text)', opacity: understood ? 1 : 0.4 }}
                  >
                    下一步
                  </button>
                  <button type="button" onClick={closeConfirm} className="rounded-[var(--admin-radius-pill)] border px-4 py-1.5 text-sm" style={{ borderColor: 'var(--admin-border-subtle)', ...primary }}>
                    取消
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium" style={primary}>
                  第 2 步：輸入系統名稱確認
                </p>
                <p className="mt-1 text-xs" style={muted}>
                  請輸入 <b>{NAME[target]}</b> 以確認切換。
                </p>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={NAME[target]}
                  autoComplete="off"
                  className="mt-3 w-full rounded-[var(--admin-radius-input)] border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)', ...primary }}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={typed.trim().toLowerCase() !== NAME[target].toLowerCase() || busy === 'public'}
                    onClick={() => void applyPublic()}
                    className="rounded-[var(--admin-radius-pill)] px-4 py-1.5 text-sm font-medium"
                    style={{
                      background: 'var(--admin-status-danger)',
                      color: 'var(--admin-brand-text)',
                      opacity: typed.trim().toLowerCase() === NAME[target].toLowerCase() ? 1 : 0.4,
                    }}
                  >
                    {busy === 'public' ? '切換中…' : `確認切換到 ${NAME[target]}`}
                  </button>
                  <button type="button" onClick={() => setStep(1)} className="rounded-[var(--admin-radius-pill)] border px-4 py-1.5 text-sm" style={{ borderColor: 'var(--admin-border-subtle)', ...primary }}>
                    返回
                  </button>
                  <button type="button" onClick={closeConfirm} className="rounded-[var(--admin-radius-pill)] border px-4 py-1.5 text-sm" style={{ borderColor: 'var(--admin-border-subtle)', ...primary }}>
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Per-account overrides ─────────────── */}
      <div className="px-5 pb-5 pt-6">
        <h3 className="text-sm font-medium" style={primary}>
          指定帳戶用邊個系統（{data?.overrides.length ?? 0}）
        </h3>
        <p className="mt-1 text-xs" style={muted}>
          呢啲帳戶無論公開系統係邊個，都用自己被指定嘅系統。用嚟先測試新系統。移除後就跟返公開系統。
        </p>
        {data && data.overrides.length === 0 && (
          <p className="mt-3 text-sm" style={muted}>
            未有指定帳戶。用下面搜尋加入。
          </p>
        )}
        <ul className="mt-3 divide-y" style={{ borderColor: 'var(--admin-border-subtle)' }}>
          {data?.overrides.map((o) => (
            <li key={o.userId} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm" style={primary}>
                  {o.displayName || o.email || o.userId}
                  {o.memberCode ? `　${o.memberCode}` : ''}
                </p>
                <p className="truncate text-xs" style={muted}>
                  {o.email}
                  {o.note ? `　· ${o.note}` : ''}
                  {o.addedBy ? `　· ${o.addedBy}` : ''}
                </p>
              </div>
              <select
                value={o.system}
                disabled={busy === o.userId}
                onChange={(e) => {
                  const v = e.target.value
                  if (isSys(v)) void setOverride(o.userId, v, o.note ?? undefined)
                }}
                className="rounded-[var(--admin-radius-input)] border px-2 py-1 text-sm"
                style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)', ...primary }}
              >
                {SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {NAME[s]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy === o.userId}
                onClick={() => void removeOverride(o.userId)}
                className="rounded-[var(--admin-radius-pill)] border px-3 py-1 text-xs"
                style={{ borderColor: 'var(--admin-border-subtle)', ...primary }}
              >
                移除
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search()
            }}
            placeholder="搜尋電郵、名稱或會員編號"
            className="min-w-[200px] flex-1 rounded-[var(--admin-radius-input)] border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)', ...primary }}
          />
          <select
            value={addSystem}
            onChange={(e) => {
              const v = e.target.value
              if (isSys(v)) setAddSystem(v)
            }}
            className="rounded-[var(--admin-radius-input)] border px-2 py-2 text-sm"
            style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)', ...primary }}
          >
            {SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {NAME[s]}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（選填）"
            maxLength={200}
            className="w-40 rounded-[var(--admin-radius-input)] border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)', ...primary }}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={busy === 'search' || query.trim().length < 2}
            className="rounded-[var(--admin-radius-pill)] px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--admin-green)', color: 'var(--admin-brand-text)', opacity: query.trim().length < 2 ? 0.4 : 1 }}
          >
            搜尋
          </button>
        </div>
        {results.length > 0 && (
          <ul className="mt-2 divide-y rounded-[var(--admin-radius-card)] border" style={{ borderColor: 'var(--admin-border-subtle)' }}>
            {results.map((u) => (
              <li key={u.userId} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" style={primary}>
                    {u.displayName || u.email}
                    {u.memberCode ? `　${u.memberCode}` : ''}
                  </p>
                  <p className="truncate text-xs" style={muted}>
                    {u.email}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === u.userId}
                  onClick={() => void setOverride(u.userId, addSystem, note)}
                  className="rounded-[var(--admin-radius-pill)] px-3 py-1 text-xs font-medium"
                  style={{ background: 'var(--admin-green)', color: 'var(--admin-brand-text)' }}
                >
                  {exists(u.userId) ? `改為 ${NAME[addSystem]}` : `指定 ${NAME[addSystem]}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
