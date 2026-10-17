'use client'

/**
 * AdminShell — mirrors `space8-admin.html` one-for-one.
 *
 * Structure (the prototype's "rapport" layer):
 *   · floating icon dock, fixed left, vertically centred, hard black pill
 *   · pill tabs in a static top bar next to the wordmark
 *   · big page title (36px / 28px on phone) + mono route chip
 *   · phone: floating pill bottom bar with the same five areas
 *
 * Only the five areas appear in navigation. Overflow routes stay mounted and
 * deep-linkable — they are just not offered here (Luca: "keep it simple").
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Calendar,
  List,
  Moon,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  ADMIN_AREAS,
  areaForPath,
  visibleItems,
  type AdminArea,
  type AdminAreaId,
} from '@/lib/admin/nav'
import { AdminToastProvider } from './ToastProvider'
import AdminRoleSelect, {
  readDevRoleOverride,
  type AdminRoleId,
} from './AdminRoleSelect'

/** Phone bottom bar — prototype NAV icons: today, list, users, site, shield. */
const TAB_ICONS: Record<AdminAreaId, LucideIcon> = {
  today: Calendar,
  bookings: List,
  members: Users,
  site: SlidersHorizontal,
  system: Shield,
}

/** Dock order matches the prototype: search, users, site, shield (no "today"). */
const DOCK_ITEMS: { id: AdminAreaId; icon: LucideIcon; title: string }[] = [
  { id: 'bookings', icon: Search, title: '搜尋預約' },
  { id: 'members', icon: Users, title: '會員' },
  { id: 'site', icon: SlidersHorizontal, title: '網站資料' },
  { id: 'system', icon: Shield, title: '系統' },
]

/**
 * Landing route for an area. Skips `superAdminOnly` leaves so a plain `admin`
 * never lands on a 403 — 網站資料 falls to /admin/maintenance, 系統 to /admin/audit.
 */
function landingHref(area: AdminArea, isSuperAdmin: boolean): string {
  const leaf = visibleItems(area.items, isSuperAdmin)[0] ?? area.items[0]
  return (leaf?.href ?? area.href).split('?')[0]
}

type AdminShellProps = {
  children: React.ReactNode
  /** Filters superAdminOnly nav items. Defaults to false (least privilege). */
  isSuperAdmin?: boolean
  /**
   * Force the active area. Used only by the unauthenticated visual harness at
   * /admin-shell-preview, which is not routed under /admin and so cannot
   * resolve an area from its own pathname. Production always omits this.
   */
  areaOverride?: AdminAreaId
}

export function AdminShell({
  children,
  isSuperAdmin = false,
  areaOverride,
}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  // `resolvedTheme`, not `theme`: the site provider is `attribute="class"` with
  // `defaultTheme="system"`, so `theme` is literally `'system'` and never
  // matches `=== 'dark'`. `resolvedTheme` is the theme CSS actually applied.
  const { resolvedTheme, setTheme } = useTheme()
  const [devRole, setDevRole] = useState<AdminRoleId | null>(null)

  const appliedTheme: 'dark' | 'light' = resolvedTheme === 'light' ? 'light' : 'dark'

  /**
   * Bridge next-themes (`class` on `<html>`) to the admin skin, which the
   * prototype switches with `data-theme` on `:root`. Without this the toggle
   * only moves a class `admin-theme.css` never reads, so admin stays dark.
   */
  useEffect(() => {
    document.documentElement.dataset.theme = appliedTheme
    document.documentElement.style.colorScheme = appliedTheme
  }, [appliedTheme])

  // Dev-only role preview. The server still enforces real permissions.
  useEffect(() => {
    setDevRole(readDevRoleOverride())
  }, [])

  const effectiveSuperAdmin =
    process.env.NODE_ENV === 'development' && devRole !== null
      ? devRole === 'super_admin'
      : isSuperAdmin
  const effectiveRoleId: AdminRoleId = effectiveSuperAdmin ? 'super_admin' : 'admin'
  const rolePreviewEnabled = process.env.NODE_ENV === 'development'

  const activeArea = areaOverride ?? areaForPath(pathname ?? '/admin')
  const active = ADMIN_AREAS.find((a) => a.id === activeArea) ?? ADMIN_AREAS[0]
  const title = active.label
  const route = landingHref(active, effectiveSuperAdmin)

  const goNewBooking = () => {
    router.push('/admin/bookings?new=1')
  }

  return (
    <AdminToastProvider>
      <div className="admin-app admin-glow-bg">
        {/* Floating icon dock (desktop / tablet landscape) */}
        <aside className="admin-dock" aria-label="快捷操作">
          <button
            type="button"
            className="primary"
            onClick={goNewBooking}
            title="手動新增預約"
            aria-label="手動新增預約"
            data-cms-key="admin.dock.new_booking"
          >
            <Plus size={20} aria-hidden />
          </button>
          <hr />
          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  const area = ADMIN_AREAS.find((a) => a.id === item.id)
                  router.push(area ? landingHref(area, effectiveSuperAdmin) : '/admin')
                }}
                title={item.title}
                aria-label={item.title}
                aria-current={activeArea === item.id ? 'page' : undefined}
                data-cms-key={`admin.dock.${item.id}`}
              >
                <Icon size={20} aria-hidden />
              </button>
            )
          })}
        </aside>

        <div className="admin-main">
          <header className="admin-top">
            <Link
              href="/admin"
              className="admin-brand-word"
              aria-label="Space8 後台"
              data-cms-key="admin.nav.brand"
            >
              <span className="admin-logo admin-logo-wordmark" aria-hidden />
            </Link>
            <Link
              href="/admin"
              className="admin-brand-mark"
              aria-label="Space8 後台"
              data-cms-key="admin.nav.brand"
            >
              <span className="admin-logo admin-logo-mark" aria-hidden />
            </Link>

            <nav className="admin-tabs" aria-label="主選單">
              {ADMIN_AREAS.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => router.push(landingHref(area, effectiveSuperAdmin))}
                  aria-current={activeArea === area.id ? 'page' : undefined}
                  data-cms-key={area.cmsKey}
                >
                  {area.label}
                </button>
              ))}
            </nav>

            <div className="admin-spacer" />

            {/* The prototype marks its mock dataset with a dashed chip. Real
                admin data is not a sample, so this only appears in dev. */}
            {process.env.NODE_ENV === 'development' && (
              <span className="admin-chip demo" data-cms-key="admin.nav.demo_data">
                示例資料
              </span>
            )}

            {/* Same pill select in every environment so the top bar matches the
                prototype. Role preview (changing the value) is dev-only. */}
            <AdminRoleSelect
              role={effectiveRoleId}
              disabled={!rolePreviewEnabled}
              onRoleChange={
                rolePreviewEnabled
                  ? (next) => setDevRole(next)
                  : undefined
              }
            />

            <button
              type="button"
              onClick={() => setTheme(appliedTheme === 'dark' ? 'light' : 'dark')}
              className="admin-icon-btn"
              aria-label="切換深淺色"
              data-cms-key="admin.nav.theme"
              style={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                border: '1px solid var(--admin-border-strong)',
                background: 'var(--admin-bg-elevated)',
                color: 'var(--admin-text-secondary)',
              }}
            >
              {/* Prototype `themeIcon()`: light shows moon (go dark), dark shows
                  sun (go light) — the icon is the action, not the current state.
                  Both icons stay in the DOM and CSS picks one via `[data-theme]`:
                  server and client markup must match, and `resolvedTheme` is
                  undefined during SSR so a conditional SVG hydrates mismatched. */}
              <Sun className="admin-theme-icon-sun" size={20} aria-hidden />
              <Moon className="admin-theme-icon-moon" size={20} aria-hidden />
            </button>
          </header>

          <div className="admin-thead">
            <h1 className="admin-ptitle" data-cms-key="admin.page.title">
              {title}
            </h1>
            <span className="admin-route">space8.com.hk{route}</span>
          </div>

          <main className="admin-page">{children}</main>
        </div>

        {/* Phone: floating pill bottom bar */}
        <nav className="admin-bnav" aria-label="主選單">
          {ADMIN_AREAS.map((area) => {
            const Icon = TAB_ICONS[area.id]
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => router.push(landingHref(area, effectiveSuperAdmin))}
                aria-current={activeArea === area.id ? 'page' : undefined}
                data-cms-key={area.cmsKey}
              >
                <Icon size={18} aria-hidden />
                <span>{area.shortLabel}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </AdminToastProvider>
  )
}

export default AdminShell
