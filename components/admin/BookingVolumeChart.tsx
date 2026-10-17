'use client'

/**
 * BookingVolumeChart — the prototype's chart7().
 *
 * Seven columns (today −3…+3) as a smoothed area chart. The curve is the same
 * centripetal-ish Catmull-Rom the prototype builds: each segment gets control
 * points at one-sixth of the neighbour chord, with the y clamped to the plot
 * box so a spike can't overshoot the grid.
 */

import { useEffect, useState } from 'react'
import type { AdminTodayWeekPoint } from '@/lib/admin/today'

type Props = { week: AdminTodayWeekPoint[] }

function buildPath(points: [number, number][], clampY: (n: number) => number): string {
  if (points.length === 0) return ''
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6)
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = clampY(p2[1] + (p3[1] - p1[1]) / 6)
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

function labelFor(point: AdminTodayWeekPoint): string {
  if (point.isToday) return '今日'
  // Prototype chart7: dd.slice(5).replace('-','/') on the ISO date, so the
  // day stays zero-padded — 10/04, not 10/4.
  return point.date.slice(5).replace('-', '/')
}

export default function BookingVolumeChart({ week }: Props) {
  // The prototype swaps geometry at 860px so the type stays legible on a phone.
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const vals = week.map((p) => p.count)
  const W = wide ? 1000 : 480
  const H = wide ? 190 : 170
  const fs = wide ? 12 : 15
  const pl = 30
  const pr = 14
  const pt = 16
  const pb = 30

  const max = Math.max(4, ...vals)
  const x = (i: number) => pl + (i * (W - pl - pr)) / 6
  const y = (n: number) => pt + (H - pt - pb) * (1 - n / max)
  const clampY = (n: number) => Math.min(H - pb, Math.max(pt, n))

  const points: [number, number][] = vals.map((n, i) => [x(i), y(n)])
  const line = buildPath(points, clampY)
  const area = `${line} L${x(6)},${H - pb} L${x(0)},${H - pb} Z`

  const total = vals.reduce((a, b) => a + b, 0)

  return (
    <section className="admin-card">
      <div className="admin-head" style={{ borderBottom: 'none', padding: '0 0 4px' }}>
        <div>
          <h3 style={{ margin: 0 }}>預約量 · 今日前後 3 日</h3>
          <p className="admin-sub">
            <b className="admin-num" style={{ fontSize: 22, color: 'var(--admin-text-primary)' }}>
              {total}
            </b>{' '}
            個預約（不含已取消）
          </p>
        </div>
      </div>

      <svg
        className="admin-chart"
        style={{ fontSize: fs }}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="前後三日預約量"
      >
        {[0, 0.5, 1].map((k) => (
          <g key={k}>
            <line
              x1={pl}
              x2={W - pr}
              y1={y(max * k)}
              y2={y(max * k)}
              className="gl"
            />
            <text
              x={pl - 8}
              y={y(max * k) + 4}
              textAnchor="end"
              className="gt"
            >
              {Math.round(max * k)}
            </text>
          </g>
        ))}

        <path d={area} className="ga" />
        <path d={line} className="gl2" />

        {points.map((p, i) => (
          <circle
            key={week[i]?.date ?? i}
            cx={p[0]}
            cy={p[1]}
            r={week[i]?.isToday ? 5 : 3.5}
            className={week[i]?.isToday ? 'gd now' : 'gd'}
          />
        ))}

        {week.map((point, i) => (
          <text
            key={point.date}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className={point.isToday ? 'gt now' : 'gt'}
          >
            {labelFor(point)}
          </text>
        ))}
      </svg>
    </section>
  )
}
