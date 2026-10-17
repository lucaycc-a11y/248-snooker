'use client'

import { useCallback, useEffect, useState } from 'react'

type MethodRow = {
  method: string
  label: string
  sublabel: string
  enabled: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseMethod(v: unknown): MethodRow | null {
  if (!isRecord(v)) return null
  if (typeof v.method !== 'string' || typeof v.label !== 'string') return null
  return {
    method: v.method,
    label: v.label,
    sublabel: typeof v.sublabel === 'string' ? v.sublabel : '',
    enabled: v.enabled === true,
  }
}

export default function PaymentMethodToggles() {
  const [methods, setMethods] = useState<MethodRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payment-settings')
      if (!res.ok) return
      const json: unknown = await res.json()
      if (isRecord(json) && Array.isArray(json.methods)) {
        setMethods(json.methods.map(parseMethod).filter((m): m is MethodRow => m !== null))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(method: string, enabled: boolean) {
    setError(null)
    setBusy(method)
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, enabled }),
      })
      const json: unknown = await res.json()
      if (!res.ok) {
        setError(isRecord(json) && typeof json.error === 'string' ? json.error : '儲存失敗')
        return
      }
      setMethods((prev) => prev.map((m) => (m.method === method ? { ...m, enabled } : m)))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      className="overflow-hidden rounded-[var(--admin-radius-card)] border"
      style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' }}
    >
      <h2
        className="border-b px-5 py-4 text-base font-semibold"
        style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-primary)' }}
        data-cms-key="admin.pay.title"
      >
        收款方式
      </h2>
      <p className="px-5 pt-4 text-xs" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.pay.note">
        關閉後，結帳頁不再顯示該付款方式。已付款的預約不受影響。
      </p>
      {error && (
        <p className="px-5 pt-3 text-sm" style={{ color: 'var(--admin-status-danger)' }}>
          {error}
        </p>
      )}
      {loading ? (
        <p className="p-5 text-sm" style={{ color: 'var(--admin-text-tertiary)' }}>
          載入中…
        </p>
      ) : (
        <ul className="flex flex-col">
          {methods.map((m) => (
            <li
              key={m.method}
              className="flex items-center gap-3 border-t px-5 py-4"
              style={{ borderColor: 'var(--admin-border-subtle)' }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>
                  {m.label}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                  {m.sublabel || m.method}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={m.enabled}
                aria-label={`${m.label} 啟用或停用`}
                disabled={busy === m.method}
                onClick={() => void toggle(m.method, !m.enabled)}
                className="relative h-7 w-12 shrink-0 rounded-[var(--admin-radius-pill)] border transition-colors"
                style={{
                  borderColor: m.enabled ? 'var(--admin-green)' : 'var(--admin-border-subtle)',
                  background: m.enabled ? 'var(--admin-green)' : 'var(--admin-bg-elevated)',
                  opacity: busy === m.method ? 0.5 : 1,
                }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
                  style={{
                    left: m.enabled ? 26 : 2,
                    background: m.enabled ? 'var(--admin-brand-text)' : 'var(--admin-text-tertiary)',
                  }}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
