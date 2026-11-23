'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { exportFramed, frameFileExt, type FrameKind } from '@/lib/pilot/frame-export'

// Phone page behind a clip QR: watch it, save it to "我的精華" (admin beta), or download it in a Space Pilot frame.

type Clip = {
  url: string; label: string; room: string; scoreA: number | null; scoreB: number | null
  players: string[]; expiresAt: string; saved: boolean
}
type State = { kind: 'loading' } | { kind: 'ready'; clip: Clip } | { kind: 'gone' } | { kind: 'error' }

function parse(v: unknown): Clip | null {
  if (typeof v !== 'object' || v === null) return null
  const o = v as Record<string, unknown>
  if (o.found !== true || typeof o.url !== 'string') return null
  return {
    url: o.url,
    label: typeof o.label === 'string' ? o.label : '',
    room: typeof o.room === 'string' ? o.room : '',
    scoreA: typeof o.scoreA === 'number' ? o.scoreA : null,
    scoreB: typeof o.scoreB === 'number' ? o.scoreB : null,
    players: Array.isArray(o.players) ? o.players.filter((p): p is string => typeof p === 'string') : [],
    expiresAt: typeof o.expiresAt === 'string' ? o.expiresAt : '',
    saved: o.saved === true,
  }
}

export default function SharedClipPage() {
  const params = useParams<{ token: string }>()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [msg, setMsg] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!/^[0-9a-f]{64}$/i.test(token)) { setState({ kind: 'gone' }); return }
    let cancelled = false
    fetch(`/api/pilot/clip/${token}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 404) return setState({ kind: 'gone' })
        const clip = res.ok ? parse(await res.json().catch(() => null)) : null
        setState(clip ? { kind: 'ready', clip } : { kind: 'error' })
      })
      .catch(() => { if (!cancelled) setState({ kind: 'error' }) })
    return () => { cancelled = true }
  }, [token])

  async function save() {
    setWorking(true)
    setMsg('')
    try {
      const res = await fetch('/api/member/pilot/clips', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
      })
      if (res.status === 401) { setMsg('請先登入會員，再重新掃描 QR 存入「我的」。'); return }
      const json: unknown = await res.json().catch(() => null)
      const o = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
      setMsg(o.enabled === false ? 'Space Pilot 現正內測，暫時只開放給管理員。' : o.saved === true ? '已存入「我的精華」（保存 30 日）。' : '儲存唔到，片可能已過期。')
    } finally {
      setWorking(false)
    }
  }

  async function download(kind: FrameKind) {
    if (state.kind !== 'ready') return
    const { clip } = state
    setWorking(true)
    setMsg('製作緊影片，請等一等…')
    try {
      const blob = await exportFramed(clip.url, kind, {
        label: clip.label, room: clip.room, scoreA: clip.scoreA, scoreB: clip.scoreB, players: clip.players,
        dateIso: new Date().toISOString(), qrUrl: window.location.href,
      })
      if (!blob) { setMsg('呢部手機暫時唔支援。'); return }
      const file = new File([blob], `space-pilot.${frameFileExt(blob)}`, { type: blob.type })
      try {
        if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Space Pilot' })
          setMsg('')
          return
        }
      } catch { setMsg(''); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      setMsg('')
    } catch {
      setMsg('製作失敗，請再試一次。')
    } finally {
      setWorking(false)
    }
  }

  const wrap: React.CSSProperties = {
    minHeight: '100dvh', background: '#000', color: '#fff', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center',
    fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif",
  }
  const btn: React.CSSProperties = { minHeight: 48, padding: '0 20px', borderRadius: 14, border: 0, color: '#fff', background: 'rgba(255,255,255,0.14)', fontSize: 15 }

  if (state.kind === 'loading') return <main style={wrap}>…</main>
  if (state.kind !== 'ready') {
    return <main style={wrap}><p style={{ fontSize: 18, margin: 0 }}>{state.kind === 'gone' ? '呢段片已經過期或唔存在。' : '暫時載入唔到，請稍後再試。'}</p></main>
  }
  const { clip } = state
  return (
    <main style={wrap}>
      <h1 style={{ margin: 0, fontSize: 18 }}>SPACE PILOT · {clip.label}</h1>
      <video src={clip.url} controls playsInline autoPlay muted loop style={{ width: '100%', maxWidth: 480, borderRadius: 16, background: '#111' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        <button type="button" disabled={working} onClick={() => void save()} style={{ ...btn, background: '#5db400' }}>存入我的精華</button>
        <button type="button" disabled={working} onClick={() => void download('winner45')} style={btn}>下載 Frame 4:5</button>
        <button type="button" disabled={working} onClick={() => void download('story916')} style={btn}>下載 Frame 9:16</button>
      </div>
      {msg ? <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{msg}</p> : null}
      {clip.expiresAt ? <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>未保存嘅片 24 小時後會自動刪除。</p> : null}
    </main>
  )
}
