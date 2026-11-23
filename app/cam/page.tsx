'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Publishable key: public by design (safe in client code). The PIN is typed by the user and never stored here.
const RPC_URL = 'https://wqmciwieiqvnswvspdyz.supabase.co/rest/v1/rpc/pilot_set_recording'
const PUBLISHABLE_KEY = 'sb_publishable_KAycCemv78UlO3k6W1VWBA_LA2WreFg'

type RpcResult = { ok: true } | { ok: false; message: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function messageFor(code: string): string {
  if (code.includes('BAD_PIN')) return 'PIN 不正確'
  if (code.includes('ROOM_NOT_FOUND')) return '找不到房間，請重新掃描 iPad 上的 QR'
  return '操作失敗，請稍後再試'
}

async function callRpc(room: string, pin: string, recording: boolean, keepalive = false): Promise<RpcResult> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ p_room: room, p_pin: pin, p_recording: recording }),
    })
    if (res.ok) return { ok: true }
    let code = ''
    try {
      const body: unknown = await res.json()
      if (isRecord(body) && typeof body.message === 'string') code = body.message
    } catch {
      // non-JSON error body
    }
    return { ok: false, message: messageFor(code) }
  } catch {
    return { ok: false, message: '連線失敗，請檢查網絡後再試' }
  }
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  const list = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  return list.find((m) => MediaRecorder.isTypeSupported(m))
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const pill: React.CSSProperties = {
  minHeight: 52, padding: '0 28px', borderRadius: 999, border: 'none',
  fontSize: 17, fontWeight: 600, cursor: 'pointer',
}

export default function CamPage() {
  const [room, setRoom] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [pin, setPin] = useState('')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [stopFailed, setStopFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [downloadExt, setDownloadExt] = useState('webm')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const flagOnRef = useRef(false) // server believes recording=true
  const roomRef = useRef('')
  const pinRef = useRef('')

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('room')
    const v = r && r.trim() ? r.trim() : ''
    setRoom(v)
    roomRef.current = v
  }, [])

  useEffect(() => { pinRef.current = pin }, [pin])

  useEffect(() => {
    if (!recording) return
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [recording])

  // Clear the iPad's red dot if the tab is closed while the flag is on.
  useEffect(() => {
    const release = () => {
      if (flagOnRef.current && roomRef.current) {
        void callRpc(roomRef.current, pinRef.current, false, true)
      }
    }
    window.addEventListener('pagehide', release)
    window.addEventListener('beforeunload', release)
    return () => {
      window.removeEventListener('pagehide', release)
      window.removeEventListener('beforeunload', release)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl) }, [downloadUrl])

  const openCamera = useCallback(async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('此瀏覽器不支援鏡頭，請改用 Safari 或 Chrome，並確認以 https 開啟')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setCameraOn(true)
    } catch {
      setError('無法開啟鏡頭，請在瀏覽器設定中允許使用鏡頭')
    }
  }, [])

  const releaseFlag = useCallback(async () => {
    const r = await callRpc(roomRef.current, pinRef.current, false)
    if (r.ok) {
      flagOnRef.current = false
      setStopFailed(false)
    } else {
      setStopFailed(true)
      setError(`警告：未能通知 iPad 結束錄影（${r.message}），iPad 上的紅點可能仍在顯示，請重試`)
    }
    return r.ok
  }, [])

  const start = useCallback(async () => {
    if (!room || !streamRef.current || busy) return
    setError('')
    if (!/^\d{4}$/.test(pin)) {
      setError('請輸入 4 位數字 PIN')
      return
    }
    setBusy(true)
    const r = await callRpc(room, pin, true)
    if (!r.ok) {
      setBusy(false)
      setError(r.message)
      return
    }
    flagOnRef.current = true
    try {
      chunksRef.current = []
      const mime = pickMime()
      const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined)
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'video/webm'
        const blob = new Blob(chunksRef.current, { type })
        setDownloadExt(type.includes('mp4') ? 'mp4' : 'webm')
        setDownloadUrl(URL.createObjectURL(blob))
      }
      rec.start(1000)
      recorderRef.current = rec
      if (downloadUrl) { URL.revokeObjectURL(downloadUrl); setDownloadUrl('') }
      setSeconds(0)
      setRecording(true)
    } catch {
      setError('無法開始錄影，此瀏覽器可能不支援')
      await releaseFlag()
    }
    setBusy(false)
  }, [room, pin, busy, downloadUrl, releaseFlag])

  const stop = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    setRecording(false)
    await releaseFlag()
    setBusy(false)
  }, [busy, releaseFlag])

  const retry = useCallback(async () => {
    setBusy(true)
    setError('')
    await releaseFlag()
    setBusy(false)
  }, [releaseFlag])

  const shell: React.CSSProperties = {
    minHeight: '100dvh', background: '#000', color: '#fff', overflowX: 'hidden',
    display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box',
    padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
    fontFamily: "'Noto Sans TC', -apple-system, sans-serif",
  }

  if (room === null) return <main style={shell} />

  if (!room) {
    return (
      <main style={{ ...shell, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <p style={{ fontSize: 18 }}>請用 iPad 上的 QR 開啟此頁</p>
      </main>
    )
  }

  return (
    <main style={shell}>
      <style>{`@keyframes camblink{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 18 }}>SPACE8 錄影</strong>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{room}</span>
      </header>

      <div style={{ position: 'relative', flex: 1, minHeight: 240, borderRadius: 24, overflow: 'hidden', background: '#111' }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {recording ? (
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.55)', padding: '6px 12px', borderRadius: 999 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff3b30', animation: 'camblink 1s infinite' }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>REC</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{fmt(seconds)}</span>
          </div>
        ) : null}
      </div>

      {error ? <p role="alert" style={{ margin: 0, color: '#ff8a80', fontSize: 14 }}>{error}</p> : null}
      {stopFailed ? (
        <button type="button" onClick={retry} disabled={busy} style={{ ...pill, background: '#ffd27a', color: '#000' }}>重試通知 iPad 結束錄影</button>
      ) : null}

      {!cameraOn ? (
        <button type="button" onClick={openCamera} style={{ ...pill, background: '#fff', color: '#000' }}>開啟鏡頭</button>
      ) : (
        <>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
            placeholder="請輸入 4 位數字 PIN"
            value={pin}
            disabled={recording}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            style={{ minHeight: 52, borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', textAlign: 'center', fontSize: 20, letterSpacing: 8 }}
          />
          {recording ? (
            <button type="button" onClick={stop} disabled={busy} style={{ ...pill, background: '#ff3b30', color: '#fff' }}>停止錄影</button>
          ) : (
            <button type="button" onClick={start} disabled={busy || stopFailed} style={{ ...pill, background: '#fff', color: '#000' }}>開始錄影</button>
          )}
        </>
      )}

      {downloadUrl ? (
        <a href={downloadUrl} download={`space8-${room}-${Date.now()}.${downloadExt}`} style={{ color: '#fff', textAlign: 'center', fontSize: 16 }}>
          下載錄影
        </a>
      ) : null}
    </main>
  )
}
