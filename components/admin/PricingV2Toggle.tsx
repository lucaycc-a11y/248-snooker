'use client'

import { useCallback, useEffect, useState } from 'react'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Kill switch for pricing v2 (連訂). One button reverts everyone — admins
 * included — to pre-v2 pricing + booking cutoff instantly (see
 * lib/pricing-v2.ts getActivePricingV2), without touching the go-live
 * schedule. Already-paid bookings are unaffected.
 */
export default function PricingV2Toggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pricing-v2')
      if (!res.ok) return
      const json: unknown = await res.json()
      if (isRecord(json) && typeof json.enabled === 'boolean') setEnabled(json.enabled)
    } catch {
      // network failure — keep the "載入中" placeholder
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(next: boolean) {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/pricing-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      const json: unknown = await res.json()
      if (!res.ok) {
        setError(isRecord(json) && typeof json.error === 'string' ? json.error : '儲存失敗')
        return
      }
      setEnabled(next)
    } finally {
      setBusy(false)
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
        data-cms-key="admin.pricing_v2.title"
      >
        連訂價（2 小時起）
      </h2>
      <p className="px-5 pt-4 text-xs" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.pricing_v2.note">
        停用即回復舊價：所有用戶（包括管理員）即時變回原價，連訂提示一併隱藏，預訂緩衝亦回復舊設定。已付款的預約不受影響。
      </p>
      {error && (
        <p className="px-5 pt-3 text-sm" style={{ color: 'var(--admin-status-danger)' }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className="text-sm" style={{ color: 'var(--admin-text-primary)' }} data-cms-key="admin.pricing_v2.state">
          {enabled == null ? '載入中…' : enabled ? '現況：已啟用' : '現況：已停用（舊價）'}
        </span>
        <button
          type="button"
          disabled={busy || enabled == null}
          onClick={() => void toggle(!enabled)}
          className="rounded-[var(--admin-radius-pill)] border px-4 py-2 text-sm font-semibold transition-opacity"
          style={{
            borderColor: enabled ? 'var(--admin-status-danger)' : 'var(--admin-green)',
            color: enabled ? 'var(--admin-status-danger)' : 'var(--admin-green)',
            opacity: busy || enabled == null ? 0.5 : 1,
          }}
        >
          {busy ? '處理中…' : enabled ? '停用連訂價（回復舊價）' : '啟用連訂價'}
        </button>
      </div>
    </section>
  )
}
