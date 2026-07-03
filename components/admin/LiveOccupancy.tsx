'use client'

import { useEffect, useState } from 'react'
import { tokens } from '@/app/styles/tokens'
import type { LiveOccupancy as LiveOccupancyData } from '@/lib/data/getAdminStats'

// Simple 30s poll rather than a Supabase Realtime subscription — Realtime
// requires enabling replication on bookings/slots, a dashboard-level Supabase
// config change that can't be made or verified without credentials in this
// environment. Polling is a same-behavior substitute for "realtime-ish".
export default function LiveOccupancy({ initial }: { initial: LiveOccupancyData }) {
  const [data, setData] = useState(initial)

  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/admin/stats')
        .then((res) => (res.ok ? res.json() : null))
        .then((json: { occupancy?: LiveOccupancyData } | null) => {
          if (json?.occupancy) setData(json.occupancy)
        })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [])

  return (
    <div>
      <div style={{ fontSize: 32, fontWeight: 700, color: tokens.colors.text }}>
        {data.tablesInUse} / {data.totalTables}
      </div>
      <div style={{ fontSize: 13, color: tokens.colors.textMuted }}>Tables in use now</div>
    </div>
  )
}
