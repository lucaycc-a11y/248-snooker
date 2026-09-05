'use client'

/**
 * MemberActions — admin member management actions (§9.2).
 *
 * Three sheet modes:
 *   - points: adjust points (requires reason)
 *   - tier: change tier (requires reason)
 *   - blacklist: toggle blacklist (requires reason)
 *
 * Calls PATCH /api/admin/members/[id] with audit logging.
 * CSS-variable only — no ui/ imports, no inline hex, no shadows.
 */

import { useState, useCallback } from 'react'
import { tierShortLabel } from '@/lib/member/tierDisplay'

type Props = {
  userId: string
  tier: string | null
  isBlacklisted: boolean
  onSuccess?: () => void
}

type SheetMode = 'points' | 'tier' | 'blacklist' | null

const VALID_TIERS = ['amateur', 'century', 'maximum'] as const

export default function MemberActions({ userId, tier, isBlacklisted, onSuccess }: Props) {
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [pointsDelta, setPointsDelta] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [selectedTier, setSelectedTier] = useState(tier ?? 'amateur')
  const [tierReason, setTierReason] = useState('')
  const [blacklistReason, setBlacklistReason] = useState('')

  const resetForm = useCallback(() => {
    setPointsDelta('')
    setPointsReason('')
    setSelectedTier(tier ?? 'amateur')
    setTierReason('')
    setBlacklistReason('')
    setError(null)
  }, [tier])

  const openSheet = useCallback(
    (mode: SheetMode) => {
      resetForm()
      setSheet(mode)
    },
    [resetForm],
  )

  const closeSheet = useCallback(() => {
    setSheet(null)
    resetForm()
  }, [resetForm])

  const submit = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/members/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? 'Failed')
        }
        closeSheet()
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    },
    [userId, closeSheet, onSuccess],
  )

  /* ── Button style helper ──────────────────────────────────────────── */
  const btnStyle = (variant: 'brand' | 'danger' | 'ghost') =>
    ({
      brand: {
        color: 'var(--admin-bg)',
        background: 'var(--admin-brand)',
        border: 'none',
      },
      danger: {
        color: 'var(--admin-text)',
        background: 'var(--admin-danger)',
        border: 'none',
      },
      ghost: {
        color: 'var(--admin-text-muted)',
        background: 'transparent',
        border: '1px solid var(--admin-border)',
      },
    })[variant]

  /* ── Overlay backdrop ──────────────────────────────────────────────── */
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    zIndex: 50,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  }

  const sheetStyle: React.CSSProperties = {
    background: 'var(--admin-surface)',
    border: '1px solid var(--admin-border)',
    borderRadius: '1.5rem 1.5rem 0 0',
    width: '100%',
    maxWidth: 420,
    padding: '1.5rem',
    maxHeight: '80vh',
    overflow: 'auto',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--admin-border)',
    background: 'var(--admin-bg)',
    color: 'var(--admin-text)',
    fontSize: '0.875rem',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--admin-text-muted)',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
    display: 'block',
  }

  /* ── Action buttons row ────────────────────────────────────────────── */
  const actionsRow = (
    <div className="flex flex-wrap gap-2" style={{ marginTop: '1rem' }}>
      <button
        type="button"
        onClick={() => openSheet('points')}
        className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
        style={btnStyle('ghost')}
      >
        + Adjust Points
      </button>
      <button
        type="button"
        onClick={() => openSheet('tier')}
        className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
        style={btnStyle('ghost')}
      >
        Change Tier
      </button>
      <button
        type="button"
        onClick={() => openSheet('blacklist')}
        className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
        style={isBlacklisted ? btnStyle('brand') : btnStyle('danger')}
      >
        {isBlacklisted ? 'Unban' : 'Ban'}
      </button>
    </div>
  )

  /* ── Points sheet ──────────────────────────────────────────────────── */
  if (sheet === 'points') {
    return (
      <div style={overlayStyle} onClick={closeSheet}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
            Adjust Points
          </h3>
          <label style={labelStyle}>Delta (positive or negative)</label>
          <input
            type="number"
            value={pointsDelta}
            onChange={(e) => setPointsDelta(e.target.value)}
            placeholder="e.g. +500 or -100"
            style={inputStyle}
          />
          <label style={{ ...labelStyle, marginTop: '0.75rem' }}>Reason</label>
          <input
            type="text"
            value={pointsReason}
            onChange={(e) => setPointsReason(e.target.value)}
            placeholder="Why this adjustment?"
            style={inputStyle}
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--admin-danger)' }}>
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeSheet}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={btnStyle('ghost')}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !pointsDelta || !pointsReason}
              onClick={() =>
                submit('adjust_points', {
                  delta: Number(pointsDelta),
                  reason: pointsReason,
                })
              }
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={btnStyle('brand')}
            >
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Tier sheet ────────────────────────────────────────────────────── */
  if (sheet === 'tier') {
    return (
      <div style={overlayStyle} onClick={closeSheet}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
            Change Tier
          </h3>
          <label style={labelStyle}>Tier</label>
          <div className="flex gap-2">
            {VALID_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTier(t)}
                className="flex-1 rounded-xl px-2 py-2 text-xs font-bold transition-colors"
                style={{
                  color:
                    selectedTier === t
                      ? 'var(--admin-brand)'
                      : 'var(--admin-text-muted)',
                  background:
                    selectedTier === t
                      ? 'var(--admin-brand-dim)'
                      : 'transparent',
                  border:
                    selectedTier === t
                      ? '1px solid var(--admin-brand)'
                      : '1px solid var(--admin-border)',
                }}
              >
                {tierShortLabel(t)}
              </button>
            ))}
          </div>
          <label style={{ ...labelStyle, marginTop: '0.75rem' }}>Reason</label>
          <input
            type="text"
            value={tierReason}
            onChange={(e) => setTierReason(e.target.value)}
            placeholder="Why this change?"
            style={inputStyle}
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--admin-danger)' }}>
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeSheet}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={btnStyle('ghost')}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !tierReason}
              onClick={() =>
                submit('set_tier', { tier: selectedTier, reason: tierReason })
              }
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={btnStyle('brand')}
            >
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Blacklist sheet ───────────────────────────────────────────────── */
  if (sheet === 'blacklist') {
    return (
      <div style={overlayStyle} onClick={closeSheet}>
        <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--admin-text)' }}>
            {isBlacklisted ? 'Unban Member' : 'Ban Member'}
          </h3>
          <label style={labelStyle}>Reason</label>
          <input
            type="text"
            value={blacklistReason}
            onChange={(e) => setBlacklistReason(e.target.value)}
            placeholder={isBlacklisted ? 'Why unban?' : 'Why ban?'}
            style={inputStyle}
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--admin-danger)' }}>
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={closeSheet}
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
              style={btnStyle('ghost')}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !blacklistReason}
              onClick={() =>
                submit('toggle_blacklist', {
                  blacklisted: !isBlacklisted,
                  reason: blacklistReason,
                })
              }
              className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={btnStyle(isBlacklisted ? 'brand' : 'danger')}
            >
              {loading ? 'Saving…' : isBlacklisted ? 'Unban' : 'Ban'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Default: action buttons ───────────────────────────────────────── */
  return actionsRow
}
