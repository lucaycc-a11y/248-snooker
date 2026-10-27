'use client'

/**
 * MemberStatsRow — the figures at the top of 會員. Computed from the loaded members with the
 * shared definitions in lib/admin/memberStats.ts, so the AI's member answers use the same numbers.
 */

import { Repeat2, UserCheck, UserPlus, Users } from 'lucide-react'
import CountUp from './CountUp'
import { money } from '@/lib/admin/today'
import type { MemberStats } from '@/lib/admin/memberStats'

type Props = {
  stats: MemberStats
  /** Server-side head count; shown instead of the loaded count if the list was cut off. */
  total: number
}

export default function MemberStatsRow({ stats, total }: Props) {
  const shownTotal = Math.max(total, stats.total)
  const cards = [
    {
      key: 'total',
      icon: Users,
      label: '會員總數',
      value: String(shownTotal),
      foot: stats.blacklisted > 0 ? `黑名單 ${stats.blacklisted} 位` : '已排除隱藏帳戶',
      primary: true,
    },
    {
      key: 'new',
      icon: UserPlus,
      label: '本週新增',
      value: String(stats.newLast7Days),
      foot: `近 30 日 ${stats.newLast30Days} 位`,
    },
    {
      key: 'booked',
      icon: UserCheck,
      label: '有預約的會員',
      value: String(stats.booked),
      foot: `佔 ${stats.bookedPercent}% · 未預約 ${stats.neverBooked} 位`,
    },
    {
      key: 'repeat',
      icon: Repeat2,
      label: '回頭客',
      value: String(stats.repeat),
      foot: stats.booked > 0 ? `預約者平均消費 ${money(stats.avgSpendPerBooked)}` : '預約 2 次或以上',
    },
  ]
  return (
    <section className="mb-stats" aria-label="會員數字">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div key={c.key} className={`mb-stat${c.primary ? ' primary' : ''}`}>
            <div className="mb-stat-top">
              <span className="mb-stat-label">{c.label}</span>
              <span className="mb-stat-ic" aria-hidden>
                <Icon size={18} />
              </span>
            </div>
            <b className="mb-stat-num">
              <CountUp text={c.value} />
            </b>
            <span className="mb-stat-foot">{c.foot}</span>
          </div>
        )
      })}
    </section>
  )
}
