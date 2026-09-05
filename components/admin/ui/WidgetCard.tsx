'use client'

import { ArrowUpRight, TrendingUp } from 'lucide-react'
import { IconButton } from './Button'

type WidgetCardProps = {
  title: string
  value: string
  trend?: string
  children: React.ReactNode
}

export default function WidgetCard({ title, value, trend, children }: WidgetCardProps) {
  return (
    <section className="sg-card sg-stat-card">
      <div className="sg-card-heading">
        <h3>{title}</h3>
        <IconButton label={`Open ${title}`}>
          <ArrowUpRight size={16} strokeWidth={1.5} />
        </IconButton>
      </div>
      <div className="sg-value-row">
        <strong className="sg-mono sg-money">{value}</strong>
        {trend && (
          <span className="sg-trend">
            <TrendingUp size={14} strokeWidth={1.5} />
            {trend}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}
