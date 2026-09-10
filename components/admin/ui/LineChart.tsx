import { useId } from 'react'

type LineChartProps = {
  labels?: string[]
  valueLabel?: string
}

export default function LineChart({
  labels = ['16', '17', '18', '19', '20', '21', '22', '23'],
  valueLabel = '+$320',
}: LineChartProps) {
  const gradientId = useId().replace(/:/g, '')

  return (
    <div className="admin-ui-chart" aria-label="Balance trend mock chart">
      <svg viewBox="0 0 320 90" preserveAspectRatio="none" role="img" aria-label="Balance trend">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--admin-green)" stopOpacity="0.24" />
            <stop offset="1" stopColor="var(--admin-green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35 L320 90 L0 90Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35"
          fill="none"
          stroke="var(--admin-green-bright)"
          strokeWidth="2"
        />
        <circle
          cx="242"
          cy="42"
          r="4"
          fill="var(--admin-bg-elevated)"
          stroke="var(--admin-green-bright)"
          strokeWidth="2"
        />
      </svg>
      <div className="admin-ui-chart__axis">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
      <span className="sr-only">{valueLabel}</span>
    </div>
  )
}
