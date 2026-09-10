'use client'

import { usePathname } from 'next/navigation'
import { Bell, CalendarDays, LayoutDashboard, MoreHorizontal, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import NavItem from './ui/NavItem'

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
  const isActive = (tab: Tab) => tab.matchExact ? pathname === tab.href : pathname?.startsWith(tab.href) ?? false

  return (
    <nav className="admin-ui-mobile-tabs fixed bottom-0 left-0 right-0 z-40 lg:hidden" aria-label="Admin mobile navigation">
      {TABS.map((tab) => (
        <NavItem key={tab.href} {...tab} active={isActive(tab)} vertical />
      ))}
    </nav>
  )
}
