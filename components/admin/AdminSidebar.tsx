'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users, Settings, FileText, UsersRound, Bot, type LucideIcon } from 'lucide-react'
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
  { href: '/admin/ai-settings', label: 'AI Settings', icon: Bot },
  { href: '/admin/team', label: 'Team', icon: UsersRound, superAdminOnly: true },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const admin = useAdmin()

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        minHeight: '100vh',
        backgroundColor: tokens.colors.bg,
        borderRight: `1px solid ${tokens.colors.border}`,
        padding: `${tokens.spacing.lg} ${tokens.spacing.md}`,
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.display,
          fontSize: 22,
          letterSpacing: 1,
          color: tokens.colors.text,
          marginBottom: tokens.spacing.xl,
          padding: `0 ${tokens.spacing.sm}`,
        }}
      >
        SPACE8
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.filter((item) => !item.superAdminOnly || admin.role === 'super_admin').map((item) => {
          const active = item.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.spacing.sm,
                padding: `10px ${tokens.spacing.sm}`,
                borderRadius: tokens.radius.button,
                color: active ? tokens.colors.text : tokens.colors.textMuted,
                backgroundColor: active ? tokens.colors.surfaceElevated : 'transparent',
                borderLeft: active ? `2px solid ${tokens.colors.brand}` : '2px solid transparent',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
              }}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
