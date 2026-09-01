'use client'

/**
 * AdminSidebar — responsive navigation sidebar.
 *
 * §2 spec breakpoints:
 *  - Desktop ≥1024px: full 240px sidebar with labels
 *  - iPad 768–1023px: collapsed 64px icon-only sidebar (click to overlay-expand)
 *  - Mobile <768px: hidden — replaced by MobileTabBar
 *
 * All inline styles replaced with Tailwind + CSS variable tokens.
 * data-cms-key on every user-visible label for CMS sync.
 */

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
  PanelLeftClose,
  PanelLeftOpen,
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
import { Logo, LogoMark } from '@/components/ui/Logo'
import { useAdmin } from '@/lib/admin/AdminContext'

type NavItem = {
  href: string
  label: string
  cmsKey: string
  icon: LucideIcon
  superAdminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', cmsKey: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', cmsKey: 'nav_bookings', icon: CalendarDays },
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
  const [mobileExpanded, setMobileExpanded] = useState(false)

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

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname?.startsWith(href) ?? false

  return (
    <>
      {/* Desktop sidebar (≥1024px) */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0 min-h-screen
          bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)]
          border-r border-[var(--admin-border)]
          p-4 gap-1
          ${hydrated && collapsed ? 'w-[72px]' : 'w-[220px]'}
          ${hydrated ? 'transition-[width] duration-200 ease-[var(--ease-standard)]' : ''}
          overflow-hidden
        `}
      >
        {/* Header: logo + collapse toggle */}
        <div
          className={`flex items-center mb-6 px-1 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed ? (
            <Logo variant="horizontal" className="h-6 w-auto" />
          ) : (
            <LogoMark size={24} />
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-7 h-7 text-[var(--admin-text-muted)] hover:text-[var(--admin-text)] bg-transparent border-none cursor-pointer"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {filteredItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                data-cms-key={item.cmsKey}
                title={collapsed ? item.label : undefined}
                className={`
                  flex items-center gap-2 no-underline text-sm font-medium
                  whitespace-nowrap
                  ${collapsed ? 'justify-center px-0 py-[10px]' : 'justify-start px-2 py-[10px]'}
                  rounded-[var(--radius-button)]
                  ${
                    active
                      ? 'bg-[var(--admin-brand-dim)] text-[var(--admin-text)] font-semibold border-l-2 border-l-[var(--admin-brand)]'
                      : 'bg-transparent text-[var(--admin-text-muted)] border-l-2 border-l-transparent'
                  }
                `}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Admin identity */}
        <div
          className={`flex items-center gap-2 px-2 py-[10px] mt-2 border-t border-[var(--admin-border)] ${
            collapsed ? 'justify-center' : 'justify-start'
          }`}
          title={collapsed ? (admin.displayName ?? admin.email) : undefined}
        >
          <div
            aria-hidden="true"
            className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 bg-[var(--admin-brand)] text-[var(--admin-brand-text)] text-xs font-bold"
          >
            {(admin.displayName ?? admin.email).charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <div
                className="text-[13px] font-semibold text-[var(--admin-text)] truncate"
                data-cms-key="sidebar_admin_name"
              >
                {admin.displayName ?? admin.email}
              </div>
              <div
                className="text-[11px] text-[var(--admin-text-muted)] capitalize"
                data-cms-key="sidebar_admin_role"
              >
                {admin.role.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* iPad sidebar (768–1023px): icon-only, click to expand overlay */}
      <aside
        className={`
          hidden md:flex lg:hidden flex-col shrink-0 min-h-screen
          bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)]
          border-r border-[var(--admin-border)]
          p-3 gap-1 w-[64px] items-center
        `}
      >
        <LogoMark size={24} className="mb-4" />
        <nav className="flex flex-col gap-0.5 flex-1 w-full items-center">
          {filteredItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                data-cms-key={item.cmsKey}
                className={`
                  flex items-center justify-center w-10 h-10 no-underline rounded-[var(--radius-button)]
                  ${
                    active
                      ? 'bg-[var(--admin-brand-dim)] text-[var(--admin-brand)]'
                      : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text)]'
                  }
                `}
                title={item.label}
              >
                <Icon size={18} />
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[var(--admin-brand)] text-[var(--admin-brand-text)] text-xs font-bold mt-2">
          {(admin.displayName ?? admin.email).charAt(0).toUpperCase()}
        </div>
      </aside>

      {/* Mobile (<768px): sidebar hidden — MobileTabBar renders in layout */}
    </>
  )
}
