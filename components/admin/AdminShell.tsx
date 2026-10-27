'use client'

/**
 * AdminShell — liquid-glass admin frame.
 *
 *   · floating glass top bar: wordmark, pill nav (a dropdown per area listing
 *     every page), labelled 新增預約 + 搜尋, role pill, theme toggle
 *   · one page title (no route chip — pages must not repeat it)
 *   · phone: floating glass bottom bar (首頁 預約 會員 收入 全部); 全部 opens
 *     the full page list
 *
 * Navigation data lives in lib/admin/nav.ts — every mounted page is listed there.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarPlus,
  Globe,
  Home,
  LayoutGrid,
  List,
  Moon,
  Search,
  Sun,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { areaForPath, itemForPath, type AdminAreaId } from '@/lib/admin/nav'
import AdminSidebar from './AdminSidebar'
import AdminCommandMenu from './AdminCommandMenu'
import BugReportDialog from './BugReportDialog'
import { AdminToastProvider } from './ToastProvider'
import { AdminProvider } from '@/lib/admin/AdminContext'
import type { AdminData } from '@/lib/data/getAdmin'
import AdminRoleSelect, {
  readDevRoleOverride,
  type AdminRoleId,
} from './AdminRoleSelect'

/** Phone bottom bar — four primary areas plus 全部 (opens the full page list). */
const PHONE_TABS: { id: AdminAreaId; label: string; href: string; icon: LucideIcon }[] = [
  { id: 'home', label: '首頁', href: '/admin', icon: Home },
  { id: 'bookings', label: '預約', href: '/admin/bookings', icon: List },
  { id: 'members', label: '會員', href: '/admin/members', icon: Users },
  { id: 'money', label: '收入', href: '/admin/revenue', icon: Wallet },
]

type AdminShellProps = {
  children: React.ReactNode
  /**
   * Signed-in admin, resolved server-side by `getAdminData()`. Mounted as
   * `AdminProvider` so client components can call `useAdmin()` (TeamTable,
   * QuickActions). Without it `useAdmin()` throws and the error boundary
   * shows 出錯了 — which is exactly what /admin/team did before this prop
   * existed.
   */
  admin: AdminData
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
  admin,
  isSuperAdmin = false,
  areaOverride,
}: AdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  // `theme` is the stored choice ('light' | 'dark' | 'system'); only an explicit
  // 'dark' turns the admin dark.
  const { theme, setTheme } = useTheme()
  const [devRole, setDevRole] = useState<AdminRoleId | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bugOpen, setBugOpen] = useState(false)

  // Admin defaults to light (27 Oct 2026). Dark only when the admin picked it
  // with the toggle — the device's system setting is ignored here.
  const appliedTheme: 'dark' | 'light' = theme === 'dark' ? 'dark' : 'light'

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

  // ⌘K / Ctrl+K opens search everywhere. A page that already handles the
  // shortcut (the bookings table focuses its own box) calls preventDefault
  // first — child effects register before this one — so it is left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setMenuOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const effectiveSuperAdmin =
    process.env.NODE_ENV === 'development' && devRole !== null
      ? devRole === 'super_admin'
      : isSuperAdmin
  const effectiveRoleId: AdminRoleId = effectiveSuperAdmin ? 'super_admin' : 'admin'
  const rolePreviewEnabled = process.env.NODE_ENV === 'development'

  const activeArea = areaOverride ?? areaForPath(pathname ?? '/admin')
  // Title follows the current leaf (longest matching page), falling back to
  // the area label. Dynamic detail routes (/bookings/[id]) resolve to their list.
  const title = itemForPath(pathname ?? '/admin')?.label ?? '後台'

  const userName = admin.displayName?.trim() || admin.email.split('@')[0]
  const userInitial = userName.slice(0, 1).toUpperCase()

  const goNewBooking = () => {
    router.push('/admin/bookings?new=1')
  }

  return (
    <AdminToastProvider>
      {/* Every client component under the shell may call useAdmin() — mount
          the provider here, not per-page, so a new page can never forget it. */}
      <AdminProvider value={admin}>
        <div className="admin-app ad-app">
          <AdminSidebar
            activeArea={activeArea}
            isSuperAdmin={effectiveSuperAdmin}
            onNewBooking={goNewBooking}
            onReportBug={() => setBugOpen(true)}
          />

          <div className="ad-main">
            <header className="ad-top">
              <Link href="/admin" className="ad-top-brand" aria-label="Space8 後台">
                <span className="admin-logo admin-logo-mark" aria-hidden />
              </Link>
              <button
                type="button"
                className="ad-search"
                onClick={() => setMenuOpen(true)}
                aria-label="搜尋頁面、預約或會員"
                data-cms-key="admin.nav.search"
              >
                <Search size={18} aria-hidden />
                <span className="ad-search-ph">搜尋頁面、預約編號或會員</span>
                <kbd className="ad-kbd">⌘K</kbd>
              </button>

              <div className="ad-top-right">
                <a href="/" target="_blank" rel="noreferrer" className="ad-site-link" aria-label="開啟網站首頁（新分頁）" data-cms-key="admin.nav.site_home">
                  <Globe size={18} aria-hidden />
                  <span>網站首頁</span>
                </a>
                <a href="/book" target="_blank" rel="noreferrer" className="ad-site-link" aria-label="開啟預約頁（新分頁）" data-cms-key="admin.nav.site_book">
                  <CalendarPlus size={18} aria-hidden />
                  <span>預約頁</span>
                </a>
                {process.env.NODE_ENV === 'development' && (
                  <span className="admin-chip demo" data-cms-key="admin.nav.demo_data">
                    示例資料
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setTheme(appliedTheme === 'dark' ? 'light' : 'dark')}
                  className="ad-icon-btn"
                  aria-label="切換深淺色"
                  data-cms-key="admin.nav.theme"
                >
                  <Sun className="admin-theme-icon-sun" size={18} aria-hidden />
                  <Moon className="admin-theme-icon-moon" size={18} aria-hidden />
                </button>
                <AdminRoleSelect
                  role={effectiveRoleId}
                  disabled={!rolePreviewEnabled}
                  onRoleChange={rolePreviewEnabled ? (next) => setDevRole(next) : undefined}
                />
                <span className="ad-user">
                  <span className="ad-user-av" aria-hidden>{userInitial}</span>
                  <span className="ad-user-text">
                    <b>{userName}</b>
                    <small>{admin.email}</small>
                  </span>
                </span>
              </div>
            </header>

            <div className="ad-head">
              <h1 className="admin-ptitle ad-title" data-cms-key="admin.page.title">
                {title}
              </h1>
            </div>

            <main className="admin-page">{children}</main>
          </div>

        {/* Phone: floating pill bottom bar */}
        <nav className="admin-bnav" aria-label="主選單">
          {PHONE_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => router.push(tab.href)}
                aria-current={activeArea === tab.id ? 'page' : undefined}
                data-cms-key={`admin.nav.${tab.id}`}
              >
                <Icon size={18} aria-hidden />
                <span>{tab.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="全部頁面"
            data-cms-key="admin.nav.all_pages"
          >
            <LayoutGrid size={18} aria-hidden />
            <span>全部</span>
          </button>
        </nav>

        <AdminCommandMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          isSuperAdmin={effectiveSuperAdmin}
          onReportBug={() => {
            setMenuOpen(false)
            setBugOpen(true)
          }}
        />
        <BugReportDialog open={bugOpen} onClose={() => setBugOpen(false)} />
        </div>
      </AdminProvider>
    </AdminToastProvider>
  )
}

export default AdminShell
