'use client'

import { useCallback, useEffect, useState } from 'react'

// 免登入付款返回頁 (v4.2.0 測試). Admin theme variables only.
type Mode = 'off' | 'admins'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export default function ReturnTokenCard() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [secretOk, setSecretOk] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-flags', { cache: 'no-store' })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok || !isRecord(json)) throw new Error('載入失敗')
      setMode(json.returnToken === 'admins' ? 'admins' : 'off')
      setSecretOk(json.secretConfigured === true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const save = async (next: Mode) => {
    if (busy || next === mode) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/payment-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnToken: next }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) throw new Error(isRecord(json) && typeof json.error === 'string' ? json.error : '儲存失敗')
      setMode(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗')
    } finally {
      setBusy(false)
    }
  }

  const card = { borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' }
  return (
    <section className="rounded-xl border p-4" style={card}>
      <h2 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }}>免登入付款返回頁（v4.2.0 測試）</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-tertiary)' }}>
        付款後若返回的瀏覽器沒有登入（例如 AlipayHK 內置瀏覽器），返回頁仍可用簽名連結查到「已確認／處理中」，不會誤報「未收到付款」。連結兩小時內有效，只能查該張訂單，不含個人資料。
      </p>
      {!secretOk && (
        <p className="mt-2 text-sm" style={{ color: 'var(--admin-text-primary)' }}>伺服器尚未設定 RETURN_TOKEN_SECRET，功能暫時不會生效。</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {([['off', '關閉'], ['admins', '只限管理員帳戶']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={busy || mode === null}
            onClick={() => void save(value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: mode === value ? 'var(--admin-text-primary)' : 'var(--admin-border-subtle)',
              color: 'var(--admin-text-primary)',
              fontWeight: mode === value ? 600 : 400,
              minHeight: 40,
            }}
          >
            {label}{mode === value ? '（目前）' : ''}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm" style={{ color: 'var(--admin-text-primary)' }}>{error}</p>}
    </section>
  )
}
