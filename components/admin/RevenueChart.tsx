'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { tokens } from '@/app/styles/tokens'
import type { RevenuePoint } from '@/lib/data/getAdminStats'

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: d.day.slice(5, 10) }))

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.colors.brand} stopOpacity={0.35} />
              <stop offset="100%" stopColor={tokens.colors.brand} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={tokens.colors.border} vertical={false} />
          <XAxis dataKey="label" stroke={tokens.colors.textMuted} fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke={tokens.colors.textMuted} fontSize={12} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            contentStyle={{
              backgroundColor: tokens.colors.surfaceElevated,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: tokens.radius.input,
              color: tokens.colors.text,
            }}
            labelStyle={{ color: tokens.colors.textMuted }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={tokens.colors.brand}
            strokeWidth={2}
            fill="url(#revenueGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
