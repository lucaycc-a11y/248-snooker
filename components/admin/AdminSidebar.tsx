'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Settings,
  FileText,
  UsersRound,
  Bot,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { useAdmin } from '@/lib/admin/AdminContext'

type NavItem = { href: string; label: string; icon: LucideIcon; superAdminOnly?: boolean }

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/admin/members', label: 'Users', icon: Users },
  { href: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/cms', label: 'Content', icon: FileText },
  { href: '/admin/blog', label: 'Blog', icon: Newspaper },
  { href: '/admin/ai-settings', label: 'AI Settings', icon: Bot },
  { href: '/admin/team', label: 'Team', icon: UsersRound, superAdminOnly: true },
]

// Same frosted-glass pill language as the public Nav (components/layout/Nav.tsx
// pillStyle, dark theme) — reused verbatim rather than a second glass recipe.
const GLASS_BG = 'rgba(255,255,255,0.05)'
const GLASS_BORDER = 'rgba(255,255,255,0.10)'
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

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
  }

  return (
    <aside
      style={{
        width: collapsed ? 72 : 220,
        flexShrink: 0,
        minHeight: '100vh',
        background: `linear-gradient(180deg, #000000 0%, #0A0A0A 100%), ${GLASS_BG}`,
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRight: `1px solid ${GLASS_BORDER}`,
        padding: `${tokens.spacing.lg} ${tokens.spacing.md}`,
        transition: hydrated ? 'width 0.2s ease' : undefined,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          marginBottom: tokens.spacing.xl,
          padding: `0 ${tokens.spacing.sm}`,
        }}
      >
        {!collapsed && (
          <div style={{ fontFamily: tokens.font.display, fontSize: 22, letterSpacing: 1, color: tokens.colors.text }}>
            SPACE8
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'transparent',
            border: 'none',
            color: tokens.colors.textMuted,
            cursor: 'pointer',
          }}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.filter((item) => !item.superAdminOnly || admin.role === 'super_admin').map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: tokens.spacing.sm,
                padding: collapsed ? '10px 0' : `10px ${tokens.spacing.sm}`,
                borderRadius: tokens.radius.button,
                color: active ? tokens.colors.text : tokens.colors.textMuted,
                backgroundColor: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                borderLeft: active ? `2px solid ${tokens.colors.link}` : '2px solid transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
