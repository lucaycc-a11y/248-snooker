'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { createClient } from '@/lib/supabase/client'

// /cam?c=<code> — phone used as the Space Pilot camera (admin beta).
// The iPad shows a QR for this page. The phone records in overlapping 14s segments (each a standalone,
// playable file), and when the iPad's score shows something worth keeping (streak, comeback, finish) it uploads
// ONE segment that covers the moment. Everything else is dropped, so Storage stays tiny.

const SEG_MS = 14000
const STAGGER_MS = 7000
const PRE_MS = 3000
const POST_MS = 3000
const POLL_MS = 2000
const PRIORITY: Record<string, number> = { manual: 1, streak: 2, key_ball: 3, finish: 4 }

type Live = { phase: string; scoreA: number; scoreB: number; players: string[] }
type Pending = { t: number; kind: string; label: string; scoreA: number; scoreB: number }
type Seg = { start: number; end: number; blob: Blob }
type Uploaded = { id: string; shareToken: string; label: string }

function pickMime(): { mime: string; ext: string } {
  const options: [string, string][] = [
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
  ]
  for (const [mime, ext] of options) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return { mime, ext }
  }
  return { mime: '', ext: 'mp4' }
}

function parseLive(data: unknown): { ok: boolean; room: string; live: Live } {
  const empty: Live = { phase: 'idle', scoreA: 0, scoreB: 0, players: [] }
  if (typeof data !== 'object' || data === null) return { ok: false, room: '', live: empty }
  const d = data as Record<string, unknown>
  const l = typeof d.live === 'object' && d.live !== null ? (d.live as Record<string, unknown>) : {}
  return {
    ok: d.ok === true,
    room: typeof d.room === 'string' ? d.room : '',
    live: {
      phase: typeof l.phase === 'string' ? l.phase : 'idle',
      scoreA: typeof l.score_a === 'number' ? l.score_a : 0,
      scoreB: typeof l.score_b === 'number' ? l.score_b : 0,
      players: Array.isArray(l.players) ? l.players.filter((p): p is string => typeof p === 'string') : [],
    },
  }
}

function CamInner() {
  const code = useSearchParams().get('c') ?? ''
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const segsRef = useRef<Seg[]>([])
  const pendingRef = useRef<Pending[]>([])
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevRef = useRef<{ phase: string; a: number; b: number; scorer: 'a' | 'b' | null; run: number } | null>(null)
  const liveRef = useRef<Live>({ phase: 'idle', scoreA: 0, scoreB: 0, players: [] })
  const matchKeyRef = useRef('')
  const mimeRef = useRef(pickMime())

  const [camReady, setCamReady] = useState(false)
  const [error, setError] = useState('')
  const [room, setRoom] = useState('')
  const [phase, setPhase] = useState('idle')
  const [recording, setRecording] = useState(false)
  const [uploads, setUploads] = useState<Uploaded[]>([])
  const [busy, setBusy] = useState(0)
  const [notice, setNotice] = useState('')

  const upload = useCallback(async (seg: Seg, ev: Pending) => {
    setBusy((n) => n + 1)
    try {
      const { ext } = mimeRef.current
      const res = await fetch('/api/pilot/cam/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code, kind: ev.kind, label: ev.label, matchKey: matchKeyRef.current, scoreA: ev.scoreA, scoreB: ev.scoreB,
          players: liveRef.current.players, durationMs: seg.end - seg.start, ext,
        }),
      })
      const json: unknown = await res.json().catch(() => null)
      const o = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {}
      if (!res.ok || typeof o.path !== 'string' || typeof o.token !== 'string' || typeof o.shareToken !== 'string') {
        setNotice(typeof o.error === 'string' && o.error.endsWith('CAP') ? '今日／今場片數已滿，唔再儲存。' : '上傳登記失敗。')
        return
      }
      const up = await createClient().storage.from('pilot-clips').uploadToSignedUrl(o.path, o.token, seg.blob, {
        contentType: seg.blob.type || (ext === 'webm' ? 'video/webm' : 'video/mp4'),
      })
      if (up.error) {
        setNotice('影片上傳失敗。')
        return
      }
      setUploads((list) => [{ id: o.path as string, shareToken: o.shareToken as string, label: ev.label }, ...list].slice(0, 8))
    } finally {
      setBusy((n) => n - 1)
    }
  }, [code])

  // Called whenever a segment finishes: if it covers a pending moment, upload it once.
  const onSegment = useCallback((seg: Seg) => {
    segsRef.current = [...segsRef.current, seg].slice(-4)
    const now = Date.now()
    pendingRef.current = pendingRef.current.filter((p) => now - p.t < 40000)
    const covered = pendingRef.current.filter((p) => seg.start <= p.t - PRE_MS && seg.end >= p.t + POST_MS)
    if (covered.length === 0) return
    pendingRef.current = pendingRef.current.filter((p) => !covered.includes(p))
    const best = covered.reduce((a, b) => ((PRIORITY[b.kind] ?? 0) > (PRIORITY[a.kind] ?? 0) ? b : a))
    void upload(seg, best)
  }, [upload])

  const startSegment = useCallback(() => {
    const stream = streamRef.current
    if (!stream || typeof MediaRecorder === 'undefined') return
    const { mime } = mimeRef.current
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 1_200_000 })
    } catch {
      setError('呢部手機唔支援錄影。')
      return
    }
    const start = Date.now()
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => {
      const type = chunks[0]?.type || mime || 'video/mp4'
      onSegment({ start, end: Date.now(), blob: new Blob(chunks, { type }) })
    }
    rec.start()
    setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, SEG_MS)
  }, [onSegment])

  const setRecordingLoop = useCallback((on: boolean) => {
    if (on && !loopRef.current) {
      startSegment()
      loopRef.current = setInterval(startSegment, STAGGER_MS)
      setRecording(true)
    } else if (!on && loopRef.current) {
      clearInterval(loopRef.current)
      loopRef.current = null
      setRecording(false)
    }
  }, [startSegment])

  const addPending = useCallback((kind: string, label: string) => {
    const l = liveRef.current
    pendingRef.current.push({ t: Date.now(), kind, label, scoreA: l.scoreA, scoreB: l.scoreB })
  }, [])

  // Camera
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined) }
        setCamReady(true)
      } catch {
        setError('開唔到鏡頭，請喺瀏覽器允許使用相機。')
      }
    })()
    let wake: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    void nav.wakeLock?.request('screen').then((w) => { wake = w }).catch(() => undefined)
    return () => {
      cancelled = true
      setRecordingLoop(false)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void wake?.release()
    }
  }, [setRecordingLoop])

  // Poll the iPad state and turn score changes into "moments".
  useEffect(() => {
    if (!/^[0-9A-Za-z]{10}$/.test(code)) { setError('配對碼無效，請重新掃描 iPad 上嘅 QR。'); return }
    let stopTimer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      try {
        const res = await fetch(`/api/pilot/cam/status?c=${code}`, { cache: 'no-store' })
        const parsed = parseLive(await res.json().catch(() => null))
        if (!parsed.ok) { setError('配對已過期，請重新掃描 iPad 上嘅 QR。'); return }
        setError('')
        setRoom(parsed.room)
        const live = parsed.live
        liveRef.current = live
        setPhase(live.phase)
        const prev = prevRef.current
        const inMatch = live.phase === 'match' || live.phase === 'winner'

        if (inMatch) {
          if (stopTimer) { clearTimeout(stopTimer); stopTimer = null }
          if (!prev || prev.phase === 'home' || prev.phase === 'idle') matchKeyRef.current = new Date().toISOString()
          setRecordingLoop(true)
        } else if (loopRef.current && !stopTimer) {
          stopTimer = setTimeout(() => { setRecordingLoop(false); stopTimer = null }, SEG_MS + 2000)
        }

        let scorer = prev?.scorer ?? null
        let run = prev?.run ?? 0
        if (prev && live.phase === 'match' && prev.phase === 'match') {
          const da = live.scoreA - prev.a
          const db = live.scoreB - prev.b
          if (da > 0 || db > 0) {
            const side: 'a' | 'b' = da > 0 ? 'a' : 'b'
            run = scorer === side ? run + (da > 0 ? da : db) : (da > 0 ? da : db)
            scorer = side
            if (run === 3) addPending('streak', '連得 3 分')
            const before = prev.a - prev.b
            const after = live.scoreA - live.scoreB
            if (before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after)) addPending('key_ball', '逆轉！')
          }
        }
        if (prev && prev.phase === 'match' && live.phase === 'winner') addPending('finish', `完場 ${live.scoreA}:${live.scoreB}`)
        if (!inMatch) { scorer = null; run = 0 }
        prevRef.current = { phase: live.phase, a: live.scoreA, b: live.scoreB, scorer, run }
      } catch {
        /* keep polling */
      }
    }
    void tick()
    const id = setInterval(() => void tick(), POLL_MS)
    return () => { clearInterval(id); if (stopTimer) clearTimeout(stopTimer) }
  }, [code, addPending, setRecordingLoop])

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const phaseText = phase === 'match' ? '比賽進行中' : phase === 'winner' ? '比賽完結' : '等待比賽開始'

  return (
    <main style={{ minHeight: '100dvh', background: '#000', color: '#fff', padding: 16, fontFamily: "'Good Times', 'Noto Sans TC', system-ui, sans-serif", display: 'flex', flexDirection: 'column', gap: 12 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>SPACE PILOT CAM</strong>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: recording ? 'rgba(230,70,70,0.3)' : 'rgba(255,255,255,0.12)' }}>
          {recording ? '● 錄影中' : '待機'}
        </span>
      </header>
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#111' }}>
        <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', objectFit: 'cover' }} />
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
        {room ? `${room} · ` : ''}{phaseText}{busy > 0 ? ' · 上傳中…' : ''}
      </p>
      {error ? <p style={{ margin: 0, color: '#ff8080' }}>{error}</p> : null}
      {notice ? <p style={{ margin: 0, color: '#ffd27a', fontSize: 13 }}>{notice}</p> : null}
      <button
        type="button"
        disabled={!camReady || !recording}
        onClick={() => addPending('manual', 'Replay')}
        style={{ minHeight: 52, borderRadius: 14, fontSize: 16, background: recording ? '#5db400' : 'rgba(255,255,255,0.12)', color: '#fff', border: 0 }}
      >
        Replay：截取呢一刻
      </button>
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        請將手機固定喺三腳架、保持亮屏同充電。只會保存精彩片段（約 14 秒），其餘畫面唔會上傳。
      </p>
      {uploads.length > 0 ? (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {uploads.map((u) => (
            <div key={u.id} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 10, textAlign: 'center' }}>
              <div style={{ background: '#fff', padding: 8, borderRadius: 10, display: 'inline-block' }}>
                <QRCodeSVG value={`${origin}/c/${u.shareToken}`} size={104} />
              </div>
              <div style={{ fontSize: 12, marginTop: 6 }}>{u.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>掃碼睇／存入我的 · 24 小時內有效</div>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  )
}

export default function CamPage() {
  return (
    <Suspense fallback={null}>
      <CamInner />
    </Suspense>
  )
}
