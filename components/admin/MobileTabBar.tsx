'use client'

/**
 * MobileTabBar — bottom navigation for admin panel on mobile (<768px).
 *
 * §2 spec: replaces sidebar entirely on mobile.
 * 5 tabs: Dashboard, Bookings, Users, Alerts, More
 * Payment Log accessible via "More".
 * Uses extracted NavItem with vertical prop for consistent active state.
 * data-cms-key on every label for CMS sync.
 * Hidden on tablet/desktop via `hidden` + `lg:hidden`.
 */

import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Bell,
  MoreHorizontal,
} from 'lucide-react'
import NavItem from './ui/NavItem'
import type { LucideIcon } from 'lucide-react'

type Tab = {
  href: string
  label: string
  cmsKey: string
  icon: LucideIcon
  matchExact?: boolean
}

const TABS: Tab[] = [
  { href: '/admin', label: 'Dashboard', cmsKey: 'tab_dashboard', icon: LayoutDashboard, matchExact: true },
  { href: '/admin/bookings', label: 'Bookings', cmsKey: 'tab_bookings', icon: CalendarDays },
  { href: '/admin/members', label: 'Users', cmsKey: 'tab_users', icon: Users },
  { href: '/admin/notifications', label: 'Alerts', cmsKey: 'tab_alerts', icon: Bell },
  { href: '/admin/settings', label: 'More', cmsKey: 'tab_more', icon: MoreHorizontal },
]

export default function MobileTabBar() {
  const pathname = usePathname()

  const isActive = (tab: Tab) =>
    tab.matchExact ? pathname === tab.href : pathname?.startsWith(tab.href) ?? false

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex lg:hidden items-center justify-around
        h-[68px] px-2 pb-[env(safe-area-inset-bottom)]
        bg-[var(--surface-primary)] border-t border-[var(--border-subtle)]"
    >
      {TABS.map((tab) => (
        <NavItem
          key={tab.href}
          href={tab.href}
          label={tab.label}
          cmsKey={tab.cmsKey}
          icon={tab.icon}
          active={isActive(tab)}
          vertical
        />
      ))}
    </nav>
  )
}
