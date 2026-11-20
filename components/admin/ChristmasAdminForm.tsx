'use client'

import { useEffect, useState } from 'react'

type Row = { userId: string; email: string; role: string; enabled: boolean }

function isRows(v: unknown): v is { admins: Row[] } {
  return typeof v === 'object' && v !== null && Array.isArray((v as { admins?: unknown }).admins)
}

export default function ChristmasAdminForm() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/christmas', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: unknown) => (isRows(j) ? setRows(j.admins) : setError('載入失敗')))
      .catch(() => setError('載入失敗'))
  }, [])

  async function toggle(row: Row) {
    setBusy(row.userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/christmas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: row.userId, enabled: !row.enabled }),
      })
      if (!res.ok) {
        setError('儲存失敗')
        return
      }
      setRows((prev) => prev?.map((r) => (r.userId === row.userId ? { ...r, enabled: !r.enabled } : r)) ?? prev)
    } catch {
      setError('網絡錯誤')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>🎄 聖誕主題預覽</h1>
      <p style={{ opacity: 0.7, margin: '8px 0 20px' }}>
        只有在此選取的管理員，登入後才會在網站見到飄雪及聖誕字句。一般訪客及會員完全看不到。
      </p>
      {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
      {!rows && !error && <p>載入中…</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
        {rows?.map((r) => (
          <li key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(128,128,128,.3)' }}>
            <span>
              {r.email} <small style={{ opacity: 0.6 }}>({r.role})</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={r.enabled}
              disabled={busy === r.userId}
              onClick={() => toggle(r)}
              style={{ padding: '6px 14px', borderRadius: 999, border: 0, cursor: 'pointer', background: r.enabled ? '#c0392b' : '#8884', color: '#fff' }}
            >
              {r.enabled ? '已開啟' : '已關閉'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
