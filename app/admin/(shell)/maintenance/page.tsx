'use client'

/**
 * Admin Venue Maintenance — §11.5.
 *
 * Toggle venue pause, set maintenance window (start/end + reason).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { useState, useCallback, useEffect } from 'react'
import MaintenanceBlocks from '@/components/admin/MaintenanceBlocks'

/* ── Types ────────────────────────────────────────────── */
type VenueStatus = {
  isPaused: boolean
  pausedSince: string | null
  maintenanceStart: string | null
  maintenanceEnd: string | null
  maintenanceReason: string | null
  lastUpdatedBy: string | null
  lastUpdatedAt: string | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/* ── Component ──────────────────────────────────────── */
export default function MaintenancePage() {
  const [status, setStatus] = useState<VenueStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [isPaused, setIsPaused] = useState(false)
  const [maintStart, setMaintStart] = useState('')
  const [maintEnd, setMaintEnd] = useState('')
  const [maintReason, setMaintReason] = useState('')

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/venue')
      if (!res.ok) throw new Error('Failed to fetch')
      const json: unknown = await res.json()
      if (isRecord(json) && isRecord(json.status)) {
        const s = json.status as Record<string, unknown>
        const parsed: VenueStatus = {
          isPaused: s.isPaused === true,
          pausedSince: str(s.pausedSince),
          maintenanceStart: str(s.maintenanceStart),
          maintenanceEnd: str(s.maintenanceEnd),
          maintenanceReason: str(s.maintenanceReason),
          lastUpdatedBy: str(s.lastUpdatedBy),
          lastUpdatedAt: str(s.lastUpdatedAt),
        }
        setStatus(parsed)
        setIsPaused(parsed.isPaused)
        setMaintStart(parsed.maintenanceStart ?? '')
        setMaintEnd(parsed.maintenanceEnd ?? '')
        setMaintReason(parsed.maintenanceReason ?? '')
      }
    } catch (err) {
      console.error('[maintenance] fetch error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/venue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPaused,
          maintenanceStart: maintStart || null,
          maintenanceEnd: maintEnd || null,
          maintenanceReason: maintReason.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const json: unknown = await res.json()
      if (isRecord(json) && isRecord(json.status)) {
        const s = json.status as Record<string, unknown>
        setStatus({
          isPaused: s.isPaused === true,
          pausedSince: str(s.pausedSince),
          maintenanceStart: str(s.maintenanceStart),
          maintenanceEnd: str(s.maintenanceEnd),
          maintenanceReason: str(s.maintenanceReason),
          lastUpdatedBy: str(s.lastUpdatedBy),
          lastUpdatedAt: str(s.lastUpdatedAt),
        })
      }
    } catch (err) {
      console.error('[maintenance] save error', err)
    } finally {
      setSaving(false)
    }
  }, [isPaused, maintStart, maintEnd, maintReason])

  const hasChanges =
    status !== null &&
    (isPaused !== status.isPaused ||
      maintStart !== (status.maintenanceStart ?? '') ||
      maintEnd !== (status.maintenanceEnd ?? '') ||
      maintReason.trim() !== (status.maintenanceReason ?? ''))

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="admin-stack">
      {loading && !status ? <p className="ad-empty">載入中…</p> : null}

      {status ? (
        <>
          <section className="admin-card" style={status.isPaused ? { borderColor: 'var(--admin-status-danger)' } : undefined}>
            <div className="ad-filters" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    aria-hidden
                    style={{ width: 10, height: 10, borderRadius: '50%', background: status.isPaused ? 'var(--admin-status-danger)' : 'var(--admin-green)' }}
                  />
                  <strong style={{ fontSize: 18 }}>{status.isPaused ? '場地暫停開放' : '場地正常開放'}</strong>
                </div>
                {status.pausedSince ? <p className="ad-muted" style={{ marginTop: 4 }}>自 {fmt(status.pausedSince)} 起暫停</p> : null}
                {status.lastUpdatedBy && status.lastUpdatedAt ? (
                  <p className="ad-muted">{status.lastUpdatedBy} 於 {fmt(status.lastUpdatedAt)} 更新</p>
                ) : null}
              </div>
              <button type="button" className="ad-btn ad-btn-primary" onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? '儲存中…' : '儲存更改'}
              </button>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-head">
              <h3 data-cms-key="admin_maintenance_pause_title">即時暫停</h3>
              <p className="ad-muted" style={{ marginTop: 4 }}>暫停所有新預約，客人會見到保養通知。既有預約不受影響。</p>
            </div>
            <div className="tm-row" style={{ borderTop: 0 }}>
              <span style={{ fontWeight: 600 }}>{isPaused ? '已暫停' : '正常開放'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isPaused}
                aria-label={isPaused ? '恢復開放' : '暫停場地'}
                onClick={() => setIsPaused(!isPaused)}
                className="tm-switch"
                data-on={isPaused}
              >
                <span className="tm-knob" />
              </button>
            </div>
          </section>

          <section className="admin-card">
            <div className="admin-head">
              <h3 data-cms-key="admin_maintenance_schedule_title">已排程保養</h3>
              <p className="ad-muted" style={{ marginTop: 4 }}>設定日後保養時段，場地會自動暫停及恢復。</p>
            </div>
            <div className="ad-filters">
              <label className="ad-field">
                <span>開始</span>
                <input className="ad-input" type="datetime-local" value={maintStart} onChange={(e) => setMaintStart(e.target.value)} />
              </label>
              <label className="ad-field">
                <span>結束</span>
                <input className="ad-input" type="datetime-local" value={maintEnd} onChange={(e) => setMaintEnd(e.target.value)} />
              </label>
              <label className="ad-field" style={{ flex: '1 1 100%' }}>
                <span>原因（會顯示給客人）</span>
                <textarea
                  className="ad-input"
                  style={{ minHeight: 88, padding: '12px 14px', resize: 'vertical' }}
                  value={maintReason}
                  onChange={(e) => setMaintReason(e.target.value)}
                  rows={3}
                  placeholder="例如：枱布更換及設備升級"
                  data-cms-key="admin_maintenance_reason_placeholder"
                />
              </label>
            </div>
          </section>
        </>
      ) : null}

      <MaintenanceBlocks />
    </div>
  )
}
