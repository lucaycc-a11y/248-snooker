'use client'

import { ArrowUpRight, Grid2X2, RefreshCw, Sparkles, TrendingDown } from 'lucide-react'
import GlassCard from './GlassCard'
import WidgetCard from './WidgetCard'
import LineChart from './LineChart'
import RingChart from './RingChart'
import BarChart from './BarChart'
import TransactionsCard from './TransactionsCard'
import { IconButton } from './Button'

type Widget = {
  id: string
  title: string
  size: string
  kind: 'number' | 'line' | 'ring' | 'bars' | 'ai'
}

type WidgetBodyProps = {
  widget: Widget
}

export default function WidgetBody({ widget }: WidgetBodyProps) {
  if (widget.kind === 'ai') {
    return (
      <GlassCard className="sg-ai-insights">
        <span className="sg-label">
          <Sparkles size={13} strokeWidth={1.5} />
          AI Insights
        </span>
        <div className="sg-ai-copy">
          <span className="sg-carousel-dots"><i /><i /><i /><i /></span>
          <p>
            Your transaction volume has increased by <b>5%</b>
            <br />
            since last month
          </p>
          <IconButton label="Open insight">
            <ArrowUpRight size={16} strokeWidth={1.5} />
          </IconButton>
        </div>
      </GlassCard>
    )
  }

  if (widget.kind === 'line') {
    return (
      <WidgetCard title="Balance Overview" value="$17,241.00" trend="12% From last month">
        <div className="sg-pills">
          <span>
            <RefreshCw size={12} strokeWidth={1.5} />
            44 transactions
          </span>
          <span>
            <Grid2X2 size={12} strokeWidth={1.5} />
            12 categories
          </span>
        </div>
        <LineChart />
      </WidgetCard>
    )
  }

  if (widget.kind === 'ring') {
    return (
      <WidgetCard title="Earnings" value="$6,400.00" trend="7% From last month">
        <RingChart />
      </WidgetCard>
    )
  }

  if (widget.kind === 'bars') {
    return (
      <WidgetCard title="Spending" value="$2,000.00">
        <span className="sg-downtrend">
          <TrendingDown size={14} strokeWidth={1.5} />
          2% From last month
        </span>
        <BarChart />
      </WidgetCard>
    )
  }

  return <TransactionsCard />
}
