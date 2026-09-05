'use client'

/**
 * AdminSidebar — responsive navigation sidebar.
 *
 * §2 spec breakpoints:
 *  - Desktop ≥1024px: full sidebar with labels (via extracted Sidebar)
 *  - iPad 768–1023px: collapsed icon-only sidebar using NavItem
 *  - Mobile <768px: hidden — replaced by MobileTabBar
 *
 * Uses extracted Sidebar, NavItem, Logo from components/admin/ui/.
 * All legacy --admin-* tokens removed; uses new design tokens.
 * data-cms-key on every user-visible label for CMS sync.
 */

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  UsersRound,
  Bot,
  Newspaper,
  Tag,
  Receipt,
  KeyRound,
  Lock,
  CreditCard,
  FileSearch,
  HeartPulse,
  Wrench,
  LockKeyhole,
  ShieldCheck,
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
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const filteredItems = NAV_ITEMS.filter(
    (item) => !item.superAdminOnly || admin.role === 'super_admin'
  )

  const activeHref = pathname ?? '/admin'

  const adminInitial = (admin.displayName ?? admin.email).charAt(0).toUpperCase()
  const adminName = admin.displayName ?? admin.email
  const adminRole = admin.role

  return (
    <>
      {/* Desktop sidebar (≥1024px) — uses extracted Sidebar */}
      <Sidebar
        items={filteredItems}
        activeHref={activeHref}
        collapsed={hydrated && collapsed}
        onToggleCollapse={toggleCollapsed}
        adminInitial={adminInitial}
        adminName={adminName}
        adminRole={adminRole}
      />

      {/* iPad sidebar (768–1023px): icon-only, collapsed NavItem */}
      <aside
        className={`
          hidden md:flex lg:hidden flex-col shrink-0 min-h-screen
          bg-[var(--surface-primary)] border-r border-[var(--border-subtle)]
          p-3 gap-1 w-[64px] items-center
        `}
      >
        <Logo className="h-6 w-auto mb-4" />
        <nav className="flex flex-col gap-0.5 flex-1 w-full items-center">
          {filteredItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              cmsKey={item.cmsKey}
              icon={item.icon}
              active={
                item.href === '/admin'
                  ? activeHref === '/admin'
                  : activeHref?.startsWith(item.href) ?? false
              }
              collapsed
            />
          ))}
        </nav>
        <div
          aria-hidden="true"
          className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--green-bright)] text-[var(--surface-primary)] text-xs font-bold mt-2"
        >
          {adminInitial}
        </div>
      </aside>

      {/* Mobile (<768px): sidebar hidden — MobileTabBar renders in layout */}
    </>
  )
}
