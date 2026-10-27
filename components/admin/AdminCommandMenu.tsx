'use client'

/**
 * AdminCommandMenu — one glass panel used two ways:
 *   · desktop/tablet: 搜尋 button opens it to find any page or a booking
 *   · phone: the 全部 tab opens it as the full page list
 *
 * Typing filters pages. Enter with no page match (or the 搜尋預約 row) goes to
 * the bookings list with the typed text as the search term.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { allNavItems, itemForPath, visibleItems, ADMIN_AREAS } from '@/lib/admin/nav'
import { usePathname } from 'next/navigation'

type Props = {
  open: boolean
  onClose: () => void
  isSuperAdmin: boolean
  onReportBug?: () => void
}

export default function AdminCommandMenu({ open, onClose, isSuperAdmin, onReportBug }: Props) {
  const router = useRouter()
  const pathname = usePathname() ?? '/admin'
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    const id = window.setTimeout(() => inputRef.current?.focus(), 30)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Close when the route changes (a link inside was pressed).
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const trimmed = query.trim()
  const activeHref = itemForPath(pathname)?.href

  const grouped = useMemo(() => {
    const needle = trimmed.toLowerCase()
    return ADMIN_AREAS.map((area) => ({
      area,
      items: visibleItems(area.items, isSuperAdmin).filter((item) => {
        if (!needle) return true
        return (
          item.label.toLowerCase().includes(needle) ||
          (item.hint ?? '').toLowerCase().includes(needle) ||
          area.label.toLowerCase().includes(needle)
        )
      }),
    })).filter((group) => group.items.length > 0)
  }, [trimmed, isSuperAdmin])

  const matchCount = useMemo(
    () => allNavItems().filter((i) => isSuperAdmin || !i.superAdminOnly).length,
    [isSuperAdmin],
  )

  if (!open) return null

  const searchBookings = () => {
    if (!trimmed) return
    router.push(`/admin/bookings?search=${encodeURIComponent(trimmed)}`)
  }

  const lookup = () => {
    if (!trimmed) return
    onClose()
    router.push(`/admin/lookup?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div
      className="admin-cmd-scrim"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="admin-cmd-panel" role="dialog" aria-modal="true" aria-label="搜尋與全部頁面">
        <div className="admin-cmd-input">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const first = grouped[0]?.items[0]
              if (first && grouped.length > 0 && trimmed && grouped.reduce((n, g) => n + g.items.length, 0) === 1) {
                router.push(first.href)
              } else {
                lookup()
              }
            }}
            placeholder={`搜尋頁面，或輸入預約編號、電話、會員編號（共 ${matchCount} 頁）`}
            aria-label="搜尋"
            enterKeyHint="search"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="admin-icon-btn"
            style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: '50%', border: 0, background: 'none', color: 'inherit' }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="admin-cmd-list">
          {trimmed ? (
            <a
              href={`/admin/lookup?q=${encodeURIComponent(trimmed)}`}
              onClick={(event) => {
                event.preventDefault()
                lookup()
              }}
            >
              查詢客人或預約「{trimmed}」
              <small>電話、會員編號、電郵、預約碼或 KPay 訂單號碼 — 顯示所有預約及付款經過</small>
            </a>
          ) : null}
          {trimmed ? (
            <a
              href={`/admin/bookings?search=${encodeURIComponent(trimmed)}`}
              onClick={(event) => {
                event.preventDefault()
                searchBookings()
              }}
            >
              在預約列表搜尋「{trimmed}」
              <small>按預約編號、電話、會員編號或姓名搜尋</small>
            </a>
          ) : null}

          {onReportBug ? (
            <button type="button" className="admin-cmd-bug" onClick={onReportBug}>
              回報問題<small>遇到錯誤或有建議，直接告訴我們</small>
            </button>
          ) : null}

          {grouped.length === 0 && !trimmed ? <div className="admin-cmd-empty">沒有可用頁面</div> : null}

          {grouped.map(({ area, items }) => (
            <div key={area.id}>
              <div className="admin-cmd-group">{area.label}</div>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={activeHref === item.href ? 'true' : undefined}
                  aria-current={activeHref === item.href ? 'page' : undefined}
                >
                  {item.label}
                  {item.hint ? <small>{item.hint}</small> : null}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
