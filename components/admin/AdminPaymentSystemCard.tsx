'use client'

import { useCallback, useEffect, useState } from 'react'

// 管理員頁 → 支付系統: each admin picks which payment system their own checkout uses (for
// testing). "跟公開系統" = no override. The public switch lives in 系統 → 支付系統.

type Sys = 'kpay' | 'stripe' | 'paymentx'
type AdminRow = { userId: string; email: string; role: string; system: Sys | null }
type State = { publicSystem: Sys; admins: AdminRow[] }

const NAME: Record<Sys, string> = { kpay: 'KPay', stripe: 'Stripe', paymentx: 'PaymentX' }

function isSys(v: string): v is Sys {
  return v === 'kpay' || v === 'stripe' || v === 'paymentx'
}

export default function AdminPaymentSystemCard() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-system', { cache: 'no-store' })
      const json = (await res.json()) as State & { error?: string }
      if (!res.ok) throw new Error(json.error ?? '載入失敗')
      setState(json)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function change(a: AdminRow, value: string) {
    setBusy(a.userId)
    try {
      const body =
        value === 'follow'
          ? { action: 'remove_override', userId: a.userId }
          : isSys(value)
            ? { action: 'set_override', userId: a.userId, system: value }
            : null
      if (!body) return
      const res = await fetch('/api/admin/payment-system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? '更改失敗')
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="admin-card tm-card">
      <div className="admin-head">
        <h3>支付系統</h3>
        <p className="tm-sub">
          每位管理員各自揀自己結帳用邊個支付系統（用嚟測試）。揀「跟公開系統」就同所有客人一樣
          {state ? `（現時公開：${NAME[state.publicSystem]}）` : ''}。切換所有客人嘅公開系統喺「系統 → 支付系統」，要 super admin 兩步確認。
        </p>
      </div>
      {error ? <p className="tm-err">{error}</p> : null}
      <ul className="tm-list">
        {!state ? <li className="tm-row">載入中…</li> : null}
        {state?.admins.map((a) => (
          <li key={a.userId} className="tm-row">
            <div className="tm-who">
              <span className="tm-email">{a.email}</span>
              <span className="tm-meta">{a.role === 'super_admin' ? '超級管理員' : '管理員'}</span>
            </div>
            <select
              aria-label={`${a.email} 支付系統`}
              value={a.system ?? 'follow'}
              disabled={busy === a.userId}
              onChange={(e) => void change(a, e.target.value)}
              style={{
                minHeight: 40,
                padding: '0 10px',
                borderRadius: 10,
                border: '1px solid var(--admin-border-subtle)',
                background: 'var(--admin-bg-surface)',
                color: 'var(--admin-text-primary)',
                fontSize: 14,
              }}
            >
              <option value="follow">跟公開系統</option>
              <option value="kpay">KPay</option>
              <option value="stripe">Stripe</option>
              <option value="paymentx">PaymentX</option>
            </select>
          </li>
        ))}
      </ul>
    </section>
  )
}
