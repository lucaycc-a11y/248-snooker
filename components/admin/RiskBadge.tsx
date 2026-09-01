/**
 * RiskBadge — member risk indicator (spec §9.3).
 *
 * risk_score = (cancelled_bookings × 2 + waived_fees × 3) / total_bookings
 *   Low   < 0.1
 *   Med   0.1–0.3
 *   High  > 0.3
 *
 * CSS-variable only — no inline hex, no shadows.
 */

export type RiskLevel = 'low' | 'medium' | 'high'

const CONFIG: Record<RiskLevel, { color: string; bg: string; label: string }> = {
  low:    { color: 'var(--admin-brand)',  bg: 'var(--admin-brand-dim)',  label: 'Low' },
  medium: { color: 'var(--admin-warning)', bg: 'var(--admin-warning-dim)', label: 'Medium' },
  high:   { color: 'var(--admin-danger)',  bg: 'var(--admin-danger-dim)',  label: 'High' },
}

export function computeRiskLevel(
  totalBookings: number,
  cancelledBookings: number,
  waivedFees: number,
): RiskLevel {
  if (totalBookings === 0) return 'low'
  const score = (cancelledBookings * 2 + waivedFees * 3) / totalBookings
  if (score > 0.3) return 'high'
  if (score >= 0.1) return 'medium'
  return 'low'
}

type Props = {
  totalBookings: number
  cancelledBookings: number
  waivedFees: number
  showScore?: boolean
}

export default function RiskBadge({
  totalBookings,
  cancelledBookings,
  waivedFees,
  showScore = false,
}: Props) {
  const level = computeRiskLevel(totalBookings, cancelledBookings, waivedFees)
  const cfg = CONFIG[level]
  const score =
    totalBookings === 0
      ? 0
      : Math.round(((cancelledBookings * 2 + waivedFees * 3) / totalBookings) * 100)

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
      title={`Risk score: ${score}% (${cancelledBookings} cancelled, ${waivedFees} waived / ${totalBookings} total)`}
    >
      {/* Dot indicator */}
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: cfg.color }}
        aria-hidden="true"
      />
      {cfg.label}
      {showScore && (
        <span style={{ fontWeight: 400, opacity: 0.8 }}>
          ({score}%)
        </span>
      )}
    </span>
  )
}
