"use client"

import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

export type PointsRule = { points: number; discount: number }

export type PointsBalance = {
  balance: number
  available: number
  rules: PointsRule[]
}

export type PointsRedemptionLabels = {
  title: string
  /** Parameterised strings are formatters, not templates — next-intl resolves
   * ICU placeholders at the call site in the parent. */
  balance: (points: number) => string
  select: (points: number, amount: number) => string
  applied: (points: number, amount: number) => string
  remove: string
  insufficient: string
}

type Props = {
  /** Pre-discount order total, used to hide rules that exceed the cart. */
  subtotal: number
  /** Currently selected points amount; 0 = nothing selected. */
  selected: number
  /** Reports the selection and the discount it buys, so the parent can show a
   * provisional total. The server re-derives both — this is display only. */
  onSelect: (pointsAmount: number, discount: number) => void
  /** Disabled while a promo code is applied — the two are mutually exclusive
   * server-side (prepare_checkout rejects the combination), so the UI must not
   * let a customer stage a selection the server will refuse. */
  disabled?: boolean
  labels: PointsRedemptionLabels
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseRules(value: unknown): PointsRule[] {
  if (!Array.isArray(value)) return []
  const rules: PointsRule[] = []
  for (const entry of value) {
    if (!isRecord(entry)) continue
    const points = typeof entry.points === 'number' ? entry.points : Number(entry.points)
    const discount = typeof entry.discount === 'number' ? entry.discount : Number(entry.discount)
    if (!Number.isFinite(points) || !Number.isFinite(discount)) continue
    if (points <= 0 || discount < 0) continue
    rules.push({ points: Math.trunc(points), discount: Math.trunc(discount) })
  }
  return rules.sort((a, b) => a.points - b.points)
}

// Member points redemption. The selection is held client-side and submitted with
// the payment-creation call, so nothing is reserved until the customer actually
// pays — the hold is taken by prepare_checkout at that moment and released on
// failure/cancellation/expiry.
export default function PointsRedemption({
  subtotal,
  selected,
  onSelect,
  disabled = false,
  labels,
}: Props) {
  const [data, setData] = useState<PointsBalance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/checkout/redeem-points', { cache: 'no-store' })
        if (!res.ok) return
        const json: unknown = await res.json()
        if (cancelled || !isRecord(json)) return
        const balance = typeof json.balance === 'number' ? json.balance : 0
        const available = typeof json.available === 'number' ? json.available : 0
        setData({ balance, available, rules: parseRules(json.rules) })
      } catch {
        // Redemption is optional — a failed lookup silently hides the section
        // rather than blocking checkout.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Clear a stale selection if a promo code takes over, so the request body
  // never carries both.
  useEffect(() => {
    if (disabled && selected > 0) onSelect(0, 0)
  }, [disabled, selected, onSelect])

  const handleToggle = useCallback(
    (rule: PointsRule) => {
      if (selected === rule.points) onSelect(0, 0)
      else onSelect(rule.points, rule.discount)
    },
    [onSelect, selected],
  )

  if (loading || !data) return null

  // Rules that cost more than the member holds, or discount more than the order,
  // are not shown at all — an unaffordable row is noise, not a call to action.
  const usable = data.rules.filter((r) => r.discount <= subtotal)
  if (usable.length === 0) return null

  const selectedRule = usable.find((r) => r.points === selected) ?? null

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: tokens.radius.card,
        padding: 20,
        marginBottom: 20,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Star size={16} style={{ color: tokens.colors.textMuted }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{labels.title}</span>
      </div>
      <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginBottom: 14 }}>
        {labels.balance(data.available)}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {usable.map((rule) => {
          const affordable = rule.points <= data.available
          const isSelected = selected === rule.points
          return (
            <button
              key={rule.points}
              type="button"
              onClick={() => handleToggle(rule)}
              disabled={!affordable}
              aria-pressed={isSelected}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: tokens.radius.button,
                border: `1px solid ${isSelected ? tokens.colors.brand : tokens.colors.border}`,
                background: isSelected ? 'rgba(255,255,255,0.10)' : 'transparent',
                color: affordable ? tokens.colors.text : tokens.colors.textMuted,
                fontSize: 13,
                cursor: affordable ? 'pointer' : 'not-allowed',
                opacity: affordable ? 1 : 0.45,
              }}
            >
              {labels.select(rule.points, rule.discount)}
            </button>
          )
        })}
      </div>

      {!usable.some((r) => r.points <= data.available) && (
        <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 12 }}>
          {labels.insufficient}
        </div>
      )}

      {selectedRule && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span style={{ fontSize: 13 }}>
            {labels.applied(selectedRule.points, selectedRule.discount)}
          </span>
          <button
            type="button"
            onClick={() => onSelect(0, 0)}
            style={{
              minHeight: 44,
              padding: '0 8px',
              background: 'none',
              border: 'none',
              color: tokens.colors.textMuted,
              fontSize: 13,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {labels.remove}
          </button>
        </div>
      )}
    </div>
  )
}
