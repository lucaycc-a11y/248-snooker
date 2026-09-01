import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { AdminProvider } from '@/lib/admin/AdminContext'
import AdminSidebar from '@/components/admin/AdminSidebar'
import AdminAIPanel from '@/components/admin/AdminAIPanel'
import AdminThemeSync from '@/components/admin/AdminThemeSync'
import MobileTabBar from '@/components/admin/MobileTabBar'

import '@/app/styles/admin-theme.css'

/**
 * Admin-only fonts — loaded via <link> in admin layout only (NOT root layout).
 * Noto Sans TC (zh-HK/zh-CN body), Inter (Latin body), JetBrains Mono (code/IDs).
 * "Good Times" (display) is already @font-face'd globally in app/globals.css.
 */
const ADMIN_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+TC:wght@400;500;700&display=swap'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminData()

  if (!admin) {
    // Not-logged-in and logged-in-but-not-admin get different destinations:
    // the latter is a silent redirect home with no error message, so a
    // logged-in non-admin can't confirm /admin exists.
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    redirect(user ? '/' : '/admin/login')
  }

  // Stored preference applies server-side; 'system' is resolved client-side
  // (matchMedia) by AdminThemeSync. data-theme lives on the wrapper <div> so
  // CSS variables cascade with zero flash-of-unstyled-content — no inline
  // <script> needed.
  const resolvedTheme = admin.themePreference === 'light' ? 'light' : 'dark'

  return (
    <AdminProvider value={admin}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={ADMIN_FONTS_HREF} rel="stylesheet" />

      <div
        data-theme={resolvedTheme}
        className="flex min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]"
      >
        <AdminSidebar />
        <div className="flex-1 min-w-0 pb-[68px] lg:pb-0">{children}</div>
        <MobileTabBar />
      </div>
      <AdminAIPanel />
      <AdminThemeSync preference={admin.themePreference} resolved={resolvedTheme} />
    </AdminProvider>
  )
}
