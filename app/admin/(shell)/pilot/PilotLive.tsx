'use client'

import { useCallback, useEffect, useState } from 'react'

type Live = {
  phase?: string
  remaining?: number
  host?: string
  players?: string[]
  game?: string
  race_to?: number
  side_a?: string[]
  side_b?: string[]
  score_a?: number
  score_b?: number
  linked?: boolean
}

type Device = {
  id: string
  room: string
  table_number: number
  live: Live | null
  live_at: string | null
  booking_end: string | null
  command_pending: boolean
}

function isDevices(value: unknown): value is { devices: Device[] } {
  if (typeof value !== 'object' || value === null) return false
  return Array.isArray((value as Record<string, unknown>).devices)
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const BTN: React.CSSProperties = { minHeight: 40, padding: '0 16px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }

export default function PilotLive() {
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pilot', { cache: 'no-store' })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok || !isDevices(json)) return setError(true)
      setDevices(json.devices)
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    void load()
    const poll = setInterval(() => void load(), 3000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  async function send(device: Device, kind: 'END_MATCH' | 'ALARM' | 'GRACE_10', confirmText: string) {
    if (!window.confirm(`${device.room}：${confirmText}？`)) return
    await fetch('/api/admin/pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: device.id, kind }),
    })
    void load()
  }

  if (error && devices.length === 0) return <p>暫時載入唔到，請稍後再試。</p>
  if (devices.length === 0) return <p>未有已綁定嘅 iPad。</p>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
      {devices.map((d) => {
        const live = d.live ?? {}
        const stale = d.live_at ? now - new Date(d.live_at).getTime() > 15000 : true
        const left = d.booking_end ? (new Date(d.booking_end).getTime() - now) / 1000 : null
        const inMatch = live.phase === 'match'
        return (
          <section key={d.id} style={{ border: '1px solid var(--admin-border, rgba(128,128,128,0.25))', borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{d.room}</h2>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{stale ? '離線／無回應' : '在線'}</span>
            </div>
            <p style={{ margin: '8px 0', fontSize: 14 }}>
              {left === null ? '現時無預約' : left > 0 ? `預約剩餘 ${mmss(left)}` : `已超時 ${mmss(-left)}`}
              {live.host ? ` · ${live.host}` : ''}
            </p>
            {inMatch ? (
              <div style={{ margin: '10px 0', padding: 12, borderRadius: 12, background: 'rgba(128,128,128,0.12)' }}>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {live.game === 'nineBall' ? '九球' : '中八'}
                  {live.race_to ? ` · 先到 ${live.race_to}` : ''}
                  {live.linked ? ' · 跨房連線' : ''}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, margin: '4px 0' }}>
                  {live.score_a ?? 0} : {live.score_b ?? 0}
                </div>
                <div style={{ fontSize: 13 }}>
                  {(live.side_a ?? []).join(' & ')} vs {(live.side_b ?? []).join(' & ')}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                {live.phase === 'idle' ? '待機中' : live.phase === 'winner' ? '顯示勝出畫面' : '未開始比賽'}
                {live.players && live.players.length > 0 ? ` · 玩家：${live.players.join('、')}` : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" style={BTN} disabled={!inMatch || d.command_pending} onClick={() => void send(d, 'END_MATCH', '結束呢場比賽')}>
                結束比賽
              </button>
              <button type="button" style={BTN} disabled={d.command_pending} onClick={() => void send(d, 'GRACE_10', '加 10 分鐘（只加 iPad 計時）')}>
                加 10 分鐘
              </button>
              <button type="button" style={{ ...BTN, background: '#c81414', color: '#fff' }} disabled={d.command_pending} onClick={() => void send(d, 'ALARM', '顯示紅色「請離開」警報')}>
                響警報
              </button>
            </div>
            {d.command_pending ? <p style={{ fontSize: 12, opacity: 0.7 }}>指令已發出，等 iPad 收到…</p> : null}
          </section>
        )
      })}
    </div>
  )
}
