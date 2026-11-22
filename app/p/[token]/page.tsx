'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Shared = { imageUrl: string; downloadUrl: string; expiresAt: string }
type State = { kind: 'loading' } | { kind: 'ready'; photo: Shared } | { kind: 'gone' } | { kind: 'error' }

function parse(value: unknown): Shared | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.image_url !== 'string' || typeof v.download_url !== 'string') return null
  return {
    imageUrl: v.image_url,
    downloadUrl: v.download_url,
    expiresAt: typeof v.expires_at === 'string' ? v.expires_at : '',
  }
}

/** Phone page behind the Space Pilot share QR: shows one photo and lets the guest save it. */
export default function SharedPhotoPage() {
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    if (!/^[0-9a-f]{64}$/i.test(token)) {
      setState({ kind: 'gone' })
      return
    }
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    let cancelled = false
    fetch(`${base}/functions/v1/pilot-photo?t=${token}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404 || res.status === 410) return setState({ kind: 'gone' })
        const photo = res.ok ? parse(await res.json().catch(() => null)) : null
        setState(photo ? { kind: 'ready', photo } : { kind: 'error' })
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const wrap: React.CSSProperties = {
    minHeight: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, textAlign: 'center',
    fontFamily: "var(--font-good-times, 'Noto Sans TC', system-ui, sans-serif)",
  }

  if (state.kind === 'loading') return <main style={wrap}>…</main>
  if (state.kind !== 'ready') {
    return (
      <main style={wrap}>
        <p style={{ fontSize: 18, margin: 0 }}>
          {state.kind === 'gone' ? '呢張相已經過期或唔存在。' : '暫時載入唔到，請稍後再試。'}
        </p>
        <p style={{ fontSize: 13, margin: 0, opacity: 0.6 }}>相片分享 24 小時後會自動刪除。</p>
      </main>
    )
  }
  return (
    <main style={wrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.photo.imageUrl} alt="Space8 photo" style={{ maxWidth: '100%', maxHeight: '70dvh', borderRadius: 20 }} />
      <a
        href={state.photo.downloadUrl}
        style={{ minHeight: 52, padding: '0 32px', display: 'inline-flex', alignItems: 'center', borderRadius: 16, background: '#fff', color: '#000', fontWeight: 700, textDecoration: 'none' }}
      >
        下載相片
      </a>
      <p style={{ fontSize: 12, margin: 0, opacity: 0.6 }}>相片 24 小時後自動刪除。</p>
    </main>
  )
}
