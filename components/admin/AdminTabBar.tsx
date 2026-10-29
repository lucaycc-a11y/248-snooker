'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { tabGroupForPath } from '@/lib/admin/nav'

/** Shared tab bar for pages that belong together (see ADMIN_TAB_GROUPS). */
export default function AdminTabBar() {
  const pathname = usePathname() ?? ''
  const hit = tabGroupForPath(pathname)
  if (!hit) return null
  return (
    <nav aria-label="相關頁面" className="atb">
      {hit.group.tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="atb-tab"
          aria-current={tab.href === hit.active ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
