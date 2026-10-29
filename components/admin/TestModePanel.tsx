'use client'

import { useCallback, useEffect, useState } from 'react'

type AdminRow = { userId: string; email: string; role: string; testMode: boolean; setBy: string | null; setAt: string | null }
type State = { isSuperAdmin: boolean; meTestMode: boolean; admins: AdminRow[] }

function useTestMode() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/test-mode', { cache: 'no-store' })
      const json = (await res.json()) as State & { error?: string }
      if (!res.ok) throw new Error(json.error ?? '載入失敗')
      setState(json)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  return { state, error, setError, reload: load }
}

/** Slim strip shown on every admin page while the signed-in admin has test mode on. */
export function TestModeBanner() {
  const { state } = useTestMode()
  if (!state?.meTestMode) return null
  return (
    <div role="status" className="tm-banner">
      <span aria-hidden className="tm-dot" />
      測試模式已開啟 — 你嘅付款會標記為測試訂位，唔會出現喺公眾預約，亦唔計入收入
    </div>
  )
}

/** Super-admin control: pick an admin and switch their test mode on/off. */
export default function TestModePanel() {
  const { state, error, setError, reload } = useTestMode()
  const [busy, setBusy] = useState<string | null>(null)

  async function toggle(a: AdminRow) {
    setBusy(a.userId)
    try {
      const res = await fetch('/api/admin/test-mode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.userId, enabled: !a.testMode }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '更改失敗')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (state && !state.isSuperAdmin) return null
  return (
    <section className="admin-card tm-card">
      <div className="admin-head">
        <h3>測試模式</h3>
        <p className="tm-sub">揀一位管理員開啟後，佢喺網站結帳嘅所有付款都會標記為測試：不顯示於公眾預約、不計入收入統計。KPay 仍然真實收款，可之後退款。</p>
      </div>
      {error ? <p className="tm-err">{error}</p> : null}
      <ul className="tm-list">
        {!state ? <li className="tm-row">載入中…</li> : null}
        {state?.admins.map((a) => (
          <li key={a.userId} className="tm-row">
            <div className="tm-who">
              <span className="tm-email">{a.email}</span>
              <span className="tm-meta">
                {a.role === 'super_admin' ? '超級管理員' : '管理員'}
                {a.testMode && a.setBy ? ` · ${a.setBy} 開啟` : ''}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={a.testMode}
              aria-label={`${a.email} 測試模式`}
              disabled={busy === a.userId}
              onClick={() => void toggle(a)}
              className="tm-switch"
              data-on={a.testMode}
            >
              <span className="tm-knob" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
