'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReleaseVersionButton({ version }: { version: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function release() {
    if (!window.confirm(`確定將 v${version} 發佈給所有人？`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/versions/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      })
      if (!res.ok) {
        const j: unknown = await res.json().catch(() => null)
        const msg =
          typeof j === 'object' && j !== null && 'error' in j && typeof (j as { error: unknown }).error === 'string'
            ? (j as { error: string }).error
            : '發佈失敗'
        setError(msg)
        return
      }
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={release}
        disabled={busy}
        data-cms-key="admin.versions.release_all"
        style={{
          padding: '10px 16px',
          borderRadius: 12,
          border: 0,
          fontWeight: 700,
          cursor: busy ? 'default' : 'pointer',
          background: '#3DDC84',
          color: '#000',
          opacity: busy ? 0.6 : 1,
        }}
      >
        發佈給所有人
      </button>
      {error ? <div style={{ marginTop: 8, fontSize: 13, color: '#ff6b6b' }}>{error}</div> : null}
    </div>
  )
}
