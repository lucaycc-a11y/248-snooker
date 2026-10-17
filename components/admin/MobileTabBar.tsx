'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, LayoutDashboard, MoreHorizontal, Shield, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ADMIN_AREAS, areaForPath, type AdminAreaId } from '@/lib/admin/nav'

const ICONS: Record<AdminAreaId, LucideIcon> = {
  today: LayoutDashboard,
  bookings: CalendarDays,
  members: Users,
  site: MoreHorizontal,
  system: Shield,
}

export default function MobileTabBar({
  onMore,
}: {
  onMore: () => void
}) {
  const pathname = usePathname()
  const active = areaForPath(pathname ?? '/admin')

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t lg:hidden"
      style={{
        background: 'var(--admin-bg-surface)',
        borderColor: 'var(--admin-border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="主選單"
    >
      {ADMIN_AREAS.map((area) => {
        const Icon = ICONS[area.id]
        const isActive = active === area.id
        return (
          <Link
            key={area.id}
            href={area.href}
            aria-current={isActive ? 'page' : undefined}
            className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px]"
            style={{
              color: isActive ? 'var(--admin-green)' : 'var(--admin-text-tertiary)',
            }}
            data-cms-key={area.cmsKey}
          >
            <Icon className="h-5 w-5" aria-hidden />
            <span>{area.label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px]"
        style={{ color: 'var(--admin-text-tertiary)' }}
        data-cms-key="admin.nav.more"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
        <span>更多</span>
      </button>
    </nav>
  )
}
