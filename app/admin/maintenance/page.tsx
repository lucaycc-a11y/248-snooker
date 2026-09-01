'use client'

/**
 * Admin Venue Maintenance — §11.5.
 *
 * Toggle venue pause, set maintenance window (start/end + reason).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { useState, useCallback, useEffect } from 'react'

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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin_maintenance_title"
        >
          Venue Maintenance
        </h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
          style={{
            color: 'var(--admin-brand-text)',
            background: 'var(--admin-brand)',
            opacity: saving || !hasChanges ? 0.4 : 1,
          }}
        >
          {saving ? <span className="admin-conic-spinner h-3.5 w-3.5" /> : 'Save Changes'}
        </button>
      </header>

      {loading && !status && (
        <div className="flex items-center justify-center py-16" style={{ color: 'var(--admin-text-muted)' }}>
          <span className="admin-conic-spinner mr-2" />
          Loading venue status…
        </div>
      )}

      {status && (
        <>
          {/* ── Current Status Card ───────────────────────────── */}
          <div
            className="flex flex-col gap-4 rounded-2xl p-6"
            style={{
              background: status.isPaused ? 'var(--admin-danger-dim)' : 'var(--admin-surface)',
              border: `1px solid ${status.isPaused ? 'var(--admin-danger)' : 'var(--admin-border)'}`,
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-3 w-3 rounded-full"
                style={{
                  background: status.isPaused ? 'var(--admin-danger, #ef4444)' : 'var(--admin-brand)',
                }}
              />
              <span className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
                {status.isPaused ? 'Venue is PAUSED' : 'Venue is Active'}
              </span>
            </div>

            {status.pausedSince && (
              <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                Paused since {new Date(status.pausedSince).toLocaleString('en-HK')}
              </p>
            )}
            {status.lastUpdatedBy && status.lastUpdatedAt && (
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                Last updated by {status.lastUpdatedBy} at {new Date(status.lastUpdatedAt).toLocaleString('en-HK')}
              </p>
            )}
          </div>

          {/* ── Pause Toggle ─────────────────────────────────── */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <h2
              className="mb-1 text-sm font-semibold"
              style={{ color: 'var(--admin-text)' }}
              data-cms-key="admin_maintenance_pause_title"
            >
              Immediate Pause
            </h2>
            <p className="mb-4 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Temporarily pause all bookings. Users will see a maintenance notice.
            </p>

            <button
              type="button"
              onClick={() => setIsPaused(!isPaused)}
              className="relative inline-flex h-8 w-14 items-center rounded-full transition-colors"
              style={{
                background: isPaused ? 'var(--admin-brand)' : 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
              }}
              aria-label={isPaused ? 'Resume venue' : 'Pause venue'}
            >
              <span
                className="inline-block h-6 w-6 rounded-full transition-transform"
                style={{
                  background: 'var(--admin-text)',
                  transform: `translateX(${isPaused ? '24px' : '4px'})`,
                }}
              />
            </button>
            <span className="ml-3 text-xs font-medium" style={{ color: 'var(--admin-text)' }}>
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>

          {/* ── Maintenance Schedule ─────────────────────────── */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <h2
              className="mb-1 text-sm font-semibold"
              style={{ color: 'var(--admin-text)' }}
              data-cms-key="admin_maintenance_schedule_title"
            >
              Scheduled Maintenance
            </h2>
            <p className="mb-4 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Set a future maintenance window. The venue will automatically pause and resume.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  Start
                </label>
                <input
                  type="datetime-local"
                  value={maintStart}
                  onChange={(e) => setMaintStart(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
                  style={{
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-text)',
                    borderColor: 'var(--admin-border)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                  End
                </label>
                <input
                  type="datetime-local"
                  value={maintEnd}
                  onChange={(e) => setMaintEnd(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
                  style={{
                    background: 'var(--admin-bg)',
                    color: 'var(--admin-text)',
                    borderColor: 'var(--admin-border)',
                  }}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--admin-text-muted)' }}>
                Reason (shown to users)
              </label>
              <textarea
                value={maintReason}
                onChange={(e) => setMaintReason(e.target.value)}
                rows={3}
                placeholder="e.g. Table re-felting and equipment upgrade"
                className="rounded-lg border px-3 py-2 text-xs outline-none transition-colors focus:border-[var(--admin-brand)]"
                style={{
                  background: 'var(--admin-bg)',
                  color: 'var(--admin-text)',
                  borderColor: 'var(--admin-border)',
                }}
                data-cms-key="admin_maintenance_reason_placeholder"
              />
            </div>
          </div>

          {/* ── Info Note ────────────────────────────────────── */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'var(--admin-surface)',
              border: '1px solid var(--admin-border)',
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'var(--admin-text-muted)' }}>
              <strong style={{ color: 'var(--admin-text)' }}>How it works:</strong> When the venue is paused, the booking page displays a maintenance notice and blocks new bookings. Existing bookings are unaffected. Scheduled maintenance windows are stored in the config table and can be updated at any time.
            </p>
          </div>
        </>
      )}
    </main>
  )
}
