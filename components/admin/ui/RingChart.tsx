'use client'

export default function RingChart() {
  return (
    <div className="sg-ring-wrap">
      <div className="sg-ring">
        <div>
          <small>Percentage</small>
          <strong>58%</strong>
        </div>
      </div>
      <div className="sg-legend">
        <span>
          <i className="sg-dot is-green" />
          Current
        </span>
        <span>
          <i className="sg-dot is-muted" />
          Month goal
        </span>
      </div>
    </div>
  )
}
