'use client'

/**
 * AdminNavMenu — desktop pill navigation. Every area is a pill; areas with more
 * than one page open a glass dropdown listing every page in that area.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import {
  areaForPath,
  itemForPath,
  visibleAreas,
  visibleItems,
  type AdminAreaId,
} from '@/lib/admin/nav'

type Props = {
  isSuperAdmin: boolean
  /** Force the active area (visual harness only). */
  areaOverride?: AdminAreaId
}

export default function AdminNavMenu({ isSuperAdmin, areaOverride }: Props) {
  const pathname = usePathname() ?? '/admin'
  const [openId, setOpenId] = useState<AdminAreaId | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)

  const activeArea = areaOverride ?? areaForPath(pathname)
  const activeItem = itemForPath(pathname)

  // Close on route change, outside press and Escape.
  useEffect(() => {
    setOpenId(null)
  }, [pathname])

  useEffect(() => {
    if (openId === null) return
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenId(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [openId])

  return (
    <nav ref={rootRef} className="admin-nav" aria-label="主選單">
      {visibleAreas(isSuperAdmin).map((area) => {
        const items = visibleItems(area.items, isSuperAdmin)
        const current = activeArea === area.id ? 'page' : undefined

        if (items.length === 1) {
          return (
            <div key={area.id} className="admin-nav-item">
              <Link
                href={items[0].href}
                className="admin-nav-btn"
                aria-current={current}
                data-cms-key={area.cmsKey}
              >
                {area.label}
              </Link>
            </div>
          )
        }

        const open = openId === area.id
        return (
          <div key={area.id} className="admin-nav-item">
            <button
              type="button"
              className="admin-nav-btn"
              aria-current={current}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : area.id)}
              data-cms-key={area.cmsKey}
            >
              {area.label}
              <ChevronDown className="chev" size={14} aria-hidden />
            </button>
            {open && (
              <div className="admin-menu" role="menu" aria-label={area.label}>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    aria-current={activeItem?.href === item.href ? 'page' : undefined}
                    data-cms-key={item.cmsKey}
                  >
                    {item.label}
                    {item.hint ? <small>{item.hint}</small> : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
