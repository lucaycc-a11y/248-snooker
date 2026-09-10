import StatusDot from './StatusDot'

type RingChartProps = {
  percentage: number
  ariaLabel: string
  label: string
  labelCmsKey: string
  currentLabel: string
  currentCmsKey: string
  goalLabel: string
  goalCmsKey: string
}

export default function RingChart({
  percentage,
  ariaLabel,
  label,
  labelCmsKey,
  currentLabel,
  currentCmsKey,
  goalLabel,
  goalCmsKey,
}: RingChartProps) {
  const safePercentage = Math.min(Math.max(percentage, 0), 100)

  return (
    <div className="admin-ui-chart">
      <div
        className="admin-ui-chart__ring"
        style={{ background: `conic-gradient(var(--admin-green) 0 ${safePercentage}%, var(--admin-border-subtle) ${safePercentage}% 100%)` }}
        role="img"
        aria-label={ariaLabel}
      >
        <span className="admin-ui-chart__ring-copy">
          <span className="admin-ui-chart__ring-label" data-cms-key={labelCmsKey}>{label}</span>
          <strong className="admin-ui-chart__ring-value">{safePercentage}%</strong>
        </span>
      </div>
      <div className="admin-ui-chart__legend">
        <span className="admin-ui-chart__legend-item">
          <StatusDot status="success" />
          <span data-cms-key={currentCmsKey}>{currentLabel}</span>
        </span>
        <span className="admin-ui-chart__legend-item">
          <StatusDot status="pending" />
          <span data-cms-key={goalCmsKey}>{goalLabel}</span>
        </span>
      </div>
    </div>
  )
}
