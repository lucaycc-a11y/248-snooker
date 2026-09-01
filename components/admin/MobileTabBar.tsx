'use client'

/**
 * MobileTabBar — bottom navigation for admin panel on mobile (<768px).
 *
 * §2 spec: replaces sidebar entirely on mobile.
 * 5 tabs: Dashboard, Bookings, Users, Notifications, More
 * Active: green icon + label; Inactive: muted icon.
 * data-cms-key on every label for CMS sync.
 * Hidden on tablet/desktop via `hidden` + `lg:hidden`.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Bell,
  MoreHorizontal,
} from 'lucide-react'

type Tab = {
  href: string
  label: string
  cmsKey: string
  icon: React.ElementType
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
        bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)]
        border-t border-[var(--admin-border)]"
    >
      {TABS.map((tab) => {
        const active = isActive(tab)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-cms-key={tab.cmsKey}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 no-underline
              ${active ? 'text-[var(--admin-brand)]' : 'text-[var(--admin-text-muted)]'}`}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
