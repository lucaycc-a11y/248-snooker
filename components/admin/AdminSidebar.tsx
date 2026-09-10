'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Bot,
  CalendarDays,
  FileSearch,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  Newspaper,
  Receipt,
  Settings,
  Tag,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import Sidebar from './ui/Sidebar'
import NavItem from './ui/NavItem'
import Logo from './ui/Logo'
import { useAdmin } from '@/lib/admin/AdminContext'

type NavItemData = {
  href: string
  label: string
  cmsKey: string
  icon: LucideIcon
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItemData[] = [
  { href: '/admin', label: 'Dashboard', cmsKey: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', cmsKey: 'nav_bookings', icon: CalendarDays },
  { href: '/admin/payment-log', label: 'Payment Log', cmsKey: 'nav_payment_log', icon: Receipt },
  { href: '/admin/members', label: 'Users', cmsKey: 'nav_users', icon: Users },
  { href: '/admin/promos', label: 'Promos', cmsKey: 'nav_promos', icon: Tag },
  { href: '/admin/audit', label: 'System Logs', cmsKey: 'nav_audit', icon: FileSearch },
  { href: '/admin/calendar', label: 'Calendar', cmsKey: 'nav_calendar', icon: CalendarDays },
  { href: '/admin/settings', label: 'Settings', cmsKey: 'nav_settings', icon: Settings },
  { href: '/admin/blog', label: 'Blog', cmsKey: 'nav_blog', icon: Newspaper },
  { href: '/admin/ai-settings', label: 'AI Settings', cmsKey: 'nav_ai_settings', icon: Bot },
  { href: '/admin/team', label: 'Team', cmsKey: 'nav_team', icon: UsersRound, superAdminOnly: true },
  { href: '/admin/door', label: 'Door Lock', cmsKey: 'nav_door', icon: KeyRound },
  { href: '/admin/site-gate', label: 'Site Gate', cmsKey: 'nav_site_gate', icon: Lock, superAdminOnly: true },
  { href: '/admin/qr-generator', label: 'QR Generator', cmsKey: 'nav_qr', icon: LockKeyhole },
  { href: '/admin/maintenance', label: 'Maintenance', cmsKey: 'nav_maintenance', icon: Wrench },
  { href: '/admin/lockers', label: 'Lockers', cmsKey: 'nav_lockers', icon: Lock },
  { href: '/admin/health', label: 'Health', cmsKey: 'nav_health', icon: HeartPulse, superAdminOnly: true },
]

const COLLAPSE_KEY = 'admin_sidebar_collapsed'

export default function AdminSidebar() {
  const pathname = usePathname()
  const admin = useAdmin()
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    setHydrated(true)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const items = NAV_ITEMS.filter((item) => !item.superAdminOnly || admin.role === 'super_admin')
  const activeHref = pathname ?? '/admin'
  const adminName = admin.displayName ?? admin.email
  const adminInitial = adminName.charAt(0).toUpperCase()
  const isActive = (href: string) => href === '/admin' ? activeHref === href : activeHref.startsWith(href)

  return (
    <>
      <div className="hidden lg:block">
        <Sidebar
          items={items}
          activeHref={activeHref}
          collapsed={hydrated && collapsed}
          onToggleCollapse={toggleCollapsed}
          adminInitial={adminInitial}
          adminName={adminName}
          adminRole={admin.role}
        />
      </div>
      <aside className="hidden md:flex lg:hidden admin-ui-sidebar admin-ui-sidebar--collapsed">
        <div className="admin-ui-sidebar__header"><Logo compact /></div>
        <nav className="admin-ui-sidebar__nav" aria-label="Admin navigation">
          {items.map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} collapsed />
          ))}
        </nav>
        <span className="admin-ui-avatar" aria-label={adminName}>{adminInitial}</span>
      </aside>
    </>
  )
}
