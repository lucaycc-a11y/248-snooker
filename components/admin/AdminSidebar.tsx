'use client'

/**
 * AdminSidebar — left navigation for tablet and desktop.
 *
 * Two groups like a classic dashboard sidebar: 主要 (daily work) and 管理
 * (site and system). Every area is one row with an SVG icon; the active
 * area expands to list its pages, so every admin page is one tap away.
 * Collapses to an icon rail between 861px and 1099px; hidden on phones,
 * where the bottom bar and the 全部 sheet take over.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bug,
  CalendarClock,
  Globe,
  Headset,
  Home,
  List,
  Plus,
  Settings2,
  Users,
  Wallet,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  itemForPath,
  visibleAreas,
  visibleItems,
  type AdminArea,
  type AdminAreaId,
} from '@/lib/admin/nav'

const ICONS: Record<AdminArea['icon'], LucideIcon> = {
  home: Home,
  today: CalendarClock,
  list: List,
  users: Users,
  support: Headset,
  money: Wallet,
  spark: Sparkles,
  site: Globe,
  shield: Settings2,
}

const MAIN: AdminAreaId[] = ['home', 'today', 'bookings', 'members', 'cs', 'money', 'spark']

type Props = {
  activeArea: AdminAreaId
  isSuperAdmin: boolean
  onNewBooking: () => void
  onReportBug: () => void
}

export default function AdminSidebar({ activeArea, isSuperAdmin, onNewBooking, onReportBug }: Props) {
  const pathname = usePathname() ?? '/admin'
  const currentItem = itemForPath(pathname)
  const areas = visibleAreas(isSuperAdmin)

  const renderArea = (area: AdminArea) => {
    const Icon = ICONS[area.icon]
    const items = visibleItems(area.items, isSuperAdmin)
    const active = activeArea === area.id
    const showSub = active && items.length > 1
    return (
      <li key={area.id}>
        <Link
          href={area.href}
          className="ad-side-link"
          aria-current={active ? 'page' : undefined}
          title={area.label}
          data-cms-key={area.cmsKey}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden />
          <span className="ad-side-label">{area.label}</span>
        </Link>
        {showSub ? (
          <ul className="ad-side-sub">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={currentItem?.href === item.href ? 'page' : undefined}
                  data-cms-key={item.cmsKey}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    )
  }

  return (
    <aside className="ad-side" aria-label="主選單">
      <Link href="/admin" className="ad-side-brand" aria-label="Space8 後台" data-cms-key="admin.nav.brand">
        <span className="admin-logo admin-logo-wordmark ad-brand-word" aria-hidden />
        <span className="admin-logo admin-logo-mark ad-brand-mark" aria-hidden />
      </Link>

      <p className="ad-side-group">主要</p>
      <ul className="ad-side-list">{areas.filter((a) => MAIN.includes(a.id)).map(renderArea)}</ul>

      <p className="ad-side-group">管理</p>
      <ul className="ad-side-list">{areas.filter((a) => !MAIN.includes(a.id)).map(renderArea)}</ul>

      <div className="ad-side-promo">
        <span className="ad-side-promo-ic" aria-hidden>
          <CalendarClock size={18} strokeWidth={1.8} />
        </span>
        <b>手動新增預約</b>
        <small>電話或到場客人，直接替對方預約</small>
        <button type="button" onClick={onNewBooking} className="ad-side-promo-btn" data-cms-key="admin.nav.new_booking">
          <Plus size={16} aria-hidden />
          新增預約
        </button>
      </div>
      <button type="button" onClick={onReportBug} className="ad-side-bug" data-cms-key="admin.nav.report_bug">
        <Bug size={16} aria-hidden />
        回報問題
      </button>
    </aside>
  )
}
