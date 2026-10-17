'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  ADMIN_AREAS,
  ADMIN_OVERFLOW,
  areaForPath,
  visibleItems,
  type AdminAreaId,
} from '@/lib/admin/nav'
import MobileTabBar from './MobileTabBar'
import { AdminToastProvider } from './ToastProvider'
import DevRoleSwitcher, { readDevRoleOverride } from './DevRoleSwitcher'

const ICONS: Record<AdminAreaId, LucideIcon> = {
  today: LayoutDashboard,
  bookings: CalendarDays,
  members: Users,
  site: Menu,
  system: Shield,
}

type AdminShellProps = {
  children: React.ReactNode
  /** Filters superAdminOnly nav items. Defaults to false (least privilege). */
  isSuperAdmin?: boolean
}

function isActiveHref(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/admin'
  const target = href.split('?')[0].replace(/\/$/, '') || '/admin'
  if (target === '/admin') return path === '/admin'
  return path === target || path.startsWith(`${target}/`)
}

export function AdminShell({ children, isSuperAdmin = false }: AdminShellProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const [devRole, setDevRole] = useState<'super_admin' | 'admin' | null>(null)

  // Dev-only role preview. Server still enforces real permissions.
  useEffect(() => {
    setDevRole(readDevRoleOverride())
  }, [])

  const effectiveSuperAdmin =
    process.env.NODE_ENV === 'development' && devRole !== null
      ? devRole === 'super_admin'
      : isSuperAdmin

  const activeArea = areaForPath(pathname ?? '/admin')
  const overflow = visibleItems(ADMIN_OVERFLOW, effectiveSuperAdmin)

  return (
    <AdminToastProvider>
    <div
      className="min-h-screen lg:grid"
      style={{
        gridTemplateColumns: '248px minmax(0, 1fr)',
        background: 'var(--admin-bg-primary)',
        color: 'var(--admin-text-primary)',
      }}
    >
      {/* Desktop left rail */}
      <aside
        className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r p-5 lg:flex"
        style={{
          background: 'var(--admin-bg-surface)',
          borderColor: 'var(--admin-border-subtle)',
        }}
        aria-label="主選單"
      >
        <Link href="/admin" className="px-2 text-[var(--admin-text-primary)]" data-cms-key="admin.nav.brand">
          <span className="text-lg font-semibold tracking-wide">Space8</span>
          <span className="block text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            後台
          </span>
        </Link>

        <nav className="flex flex-col gap-1">
          {ADMIN_AREAS.map((area) => {
            const Icon = ICONS[area.id]
            const isActive = activeArea === area.id
            return (
              <div key={area.id} className="flex flex-col gap-1">
                <Link
                  href={area.href}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex min-h-[44px] items-center gap-3 rounded-[var(--admin-radius-input)] border px-3 text-sm font-medium"
                  style={{
                    background: isActive ? 'color-mix(in srgb, var(--admin-green) 12%, transparent)' : 'transparent',
                    borderColor: isActive ? 'var(--admin-border-subtle)' : 'transparent',
                    color: isActive ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)',
                  }}
                  data-cms-key={area.cmsKey}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span>{area.label}</span>
                </Link>
                {isActive && area.items.length > 1 && (
                  <div className="ml-8 flex flex-col gap-1">
                    {visibleItems(area.items, effectiveSuperAdmin).map((item) => {
                      const itemActive = isActiveHref(pathname ?? '/admin', item.match ?? item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={itemActive ? 'page' : undefined}
                          className="rounded-[var(--admin-radius-input)] px-3 py-2 text-[13px]"
                          style={{
                            color: itemActive ? 'var(--admin-green)' : 'var(--admin-text-tertiary)',
                          }}
                          data-cms-key={item.cmsKey}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {overflow.length > 0 && (
          <div className="mt-auto flex flex-col gap-1 border-t pt-4" style={{ borderColor: 'var(--admin-border-subtle)' }}>
            <p className="px-2 pb-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.nav.more">
              更多
            </p>
            {overflow.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[var(--admin-radius-input)] px-3 py-2 text-[13px]"
                style={{ color: 'var(--admin-text-tertiary)' }}
                data-cms-key={item.cmsKey}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex min-h-[44px] items-center gap-3 rounded-[var(--admin-radius-input)] border px-3 text-sm"
          style={{
            borderColor: 'var(--admin-border-subtle)',
            color: 'var(--admin-text-secondary)',
          }}
          data-cms-key="admin.nav.theme"
        >
          {theme === 'dark' ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
          <span>{theme === 'dark' ? '深色' : '淺色'}</span>
        </button>

        <DevRoleSwitcher />

        <Link
          href="/api/auth/signout"
          className="flex min-h-[44px] items-center gap-3 rounded-[var(--admin-radius-input)] px-3 text-sm"
          style={{ color: 'var(--admin-text-tertiary)' }}
          data-cms-key="admin.nav.signout"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span>登出</span>
        </Link>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 lg:px-6"
          style={{
            background: 'color-mix(in srgb, var(--admin-bg-primary) 90%, transparent)',
            backdropFilter: 'blur(8px)',
            borderColor: 'var(--admin-border-subtle)',
          }}
        >
          <Link href="/admin" className="lg:hidden text-[var(--admin-text-primary)]" data-cms-key="admin.nav.brand">
            <span className="text-base font-semibold">Space8</span>
          </Link>
          <span
            className="hidden rounded-full border px-3 py-1 text-xs lg:inline"
            style={{
              borderColor: 'var(--admin-border-subtle)',
              color: 'var(--admin-text-tertiary)',
            }}
          >
            space8.com.hk/admin
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="grid h-11 w-11 place-items-center rounded-[var(--admin-radius-input)] border lg:hidden"
            style={{
              borderColor: 'var(--admin-border-subtle)',
              background: 'var(--admin-bg-surface)',
              color: 'var(--admin-text-secondary)',
            }}
            aria-label="切換深淺色"
          >
            {theme === 'dark' ? <Moon className="h-5 w-5" aria-hidden /> : <Sun className="h-5 w-5" aria-hidden />}
          </button>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 lg:px-6 lg:pb-8">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <MobileTabBar onMore={() => setMoreOpen(true)} />

      {/* Mobile overflow drawer */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end lg:hidden"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full overflow-y-auto rounded-t-[var(--admin-radius-card)] border p-5"
            style={{
              background: 'var(--admin-bg-elevated)',
              borderColor: 'var(--admin-border-subtle)',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="更多"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold" data-cms-key="admin.nav.more">
                更多
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-[var(--admin-radius-input)] border"
                style={{
                  borderColor: 'var(--admin-border-subtle)',
                  color: 'var(--admin-text-secondary)',
                }}
                aria-label="關閉"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {overflow.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="rounded-[var(--admin-radius-input)] px-3 py-3 text-sm"
                  style={{ color: 'var(--admin-text-secondary)' }}
                  data-cms-key={item.cmsKey}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminToastProvider>
  )
}
