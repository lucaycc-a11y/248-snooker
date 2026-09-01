import { Suspense } from 'react'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminStats } from '@/lib/data/getAdminStats'
import { getServiceSupabase } from '@/lib/supabase/service'
import { DEFAULT_LAYOUT } from '@/lib/admin/widgetMeta'
import type { LayoutItem } from '@/lib/admin/widgetMeta'
import DashboardGrid from '@/components/admin/DashboardGrid'

/**
 * Admin Dashboard — §3.
 *
 * Server Component that fetches admin role + saved layout, then passes
 * both to the client-side DashboardGrid which handles dnd-kit interactivity.
 */

function isLayoutArray(value: unknown): value is LayoutItem[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).size === 'string'
    )
  )
}

export default async function AdminDashboardPage() {
  const admin = await getAdminData()
  const isAdmin = admin?.role === 'super_admin' || admin?.role === 'admin'

  // Fetch saved layout (best-effort; falls back to DEFAULT_LAYOUT)
  let layout: LayoutItem[] = DEFAULT_LAYOUT
  try {
    if (admin?.userId) {
      const service = getServiceSupabase()
      const { data } = await service
        .from('admin_dashboard_config')
        .select('layout')
        .eq('admin_id', admin.userId)
        .maybeSingle()

      if (data?.layout && isLayoutArray(data.layout)) {
        layout = data.layout
      }
    }
  } catch {
    // Table may not exist — use default layout
  }

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-8 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-[var(--admin-text)] tracking-tight"
          data-cms-key="admin_dashboard_title"
        >
          Dashboard
        </h1>
        <p className="text-sm text-[var(--admin-text-muted)] mt-1">
          Welcome back, {admin?.displayName ?? admin?.email ?? 'Admin'}
        </p>
      </div>

      {/* Widget grid — client-side dnd-kit */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardGrid initialLayout={layout} isAdmin={isAdmin} />
      </Suspense>
    </main>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={`min-h-[160px] rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]/60 backdrop-blur-xl animate-pulse ${
            i % 3 === 0 ? 'md:col-span-2' : ''
          }`}
        >
          <div className="p-4 space-y-3">
            <div className="h-3 bg-[var(--admin-surface)] rounded w-1/3" />
            <div className="h-8 bg-[var(--admin-surface)] rounded w-1/2" />
            <div className="h-3 bg-[var(--admin-surface)] rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
