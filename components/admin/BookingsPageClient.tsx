'use client'

/**
 * BookingsPageClient — the 預約 area, ported from `space8-admin.html` `vBookings()`.
 *
 * Header row (title/sub + test toggle + manual CTA), a 4-up toolbar (search,
 * status, from, to), then a flat card holding the `.li-bk` grid and the pager.
 * BookingDrawer + ManualBookingWizard keep their existing wiring.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import BookingDrawer from '@/components/admin/BookingDrawer'
import ManualBookingWizard from '@/components/admin/ManualBookingWizard'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'
import {
  BOOKING_STATUS,
  dateLabel,
  money,
  statusOf,
} from '@/lib/admin/today'

type ApiResponse = {
  bookings: AdminBookingRow[]
  total: number
  page: number
  pageSize: number
  /** Non-null = load failed. Show the message, never a fake empty list. */
  error?: string | null
}

/** Must match `PAGE_SIZE` in lib/data/getAdminBookings.ts. */
const PAGE_SIZE = 8

const STATUS_OPTIONS: [string, string][] = [
  ['all', '全部狀態'],
  ...Object.entries(BOOKING_STATUS).map(([key, value]) => [key, value[0]] as [string, string]),
]

function formatPhone(raw: string | null): string {
  if (!raw) return '—'
  const digits = raw.replace(/\D/g, '')
  const tail = digits.slice(-8)
  return tail.length === 8 ? `${tail.slice(0, 4)} ${tail.slice(4)}` : raw
}

export default function BookingsPageClient({
  initial,
  preview = false,
}: {
  initial: ApiResponse
  /**
   * Freeze `initial` and skip the API. Used only by the unauthenticated
   * visual harness at /admin-shell-preview — production always omits this.
   */
  preview?: boolean
}) {
  const router = useRouter()
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showWizard, setShowWizard] = useState(false)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showTest, setShowTest] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ApiResponse>(initial)
  const [loading, setLoading] = useState(false)

  // The floating dock's green 手動新增預約 button routes here with ?new=1.
  // Open the wizard once, then strip the param so a refresh does not reopen it.
  // Read via window rather than useSearchParams so the page needs no Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('new') !== '1') return
    setShowWizard(true)
    params.delete('new')
    const qs = params.toString()
    window.history.replaceState(
      null,
      '',
      window.location.pathname + (qs ? `?${qs}` : ''),
    )
  }, [])

  const [loadError, setLoadError] = useState<string | null>(null)
  // Debounced copy of the search box: typing must not fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const reqSeq = useRef(0)
  const load = useCallback(async () => {
    if (preview) return
    const seq = ++reqSeq.current
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('isTest', showTest ? 'true' : 'false')
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status !== 'all') params.set('status', status)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/admin/bookings?${params.toString()}`)
      const json: unknown = await res.json().catch(() => null)
      if (seq !== reqSeq.current) return // a newer request superseded this one
      if (!res.ok) {
        const msg = (json as { error?: string } | null)?.error
        setLoadError(msg ?? `預約資料載入失敗（${res.status}）`)
        return
      }
      if (isApiResponse(json)) {
        setLoadError(null)
        setData(json)
      }
    } catch (e) {
      if (seq === reqSeq.current) setLoadError(e instanceof Error ? e.message : '預約資料載入失敗')
    } finally {
      if (seq === reqSeq.current) setLoading(false)
    }
  }, [preview, page, showTest, debouncedSearch, status, dateFrom, dateTo])

  // Refetch on filter/page change and after a drawer action mutates a row.
  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const pages = useMemo(
    () => Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
    [data.total],
  )

  const rows = data.bookings

  return (
    <>
      {/* ── Header: title/sub + test toggle + manual CTA ───────────── */}
      <div className="admin-page-head">
        <div>
          <h2 style={{ margin: 0 }}>預約</h2>
          <p className="admin-sub" style={{ margin: 0 }}>
            電話、會員編號、預約碼或參考編號
          </p>
        </div>
        <div className="admin-row">
          <button
            type="button"
            role="switch"
            aria-checked={showTest}
            className="admin-switch"
            onClick={() => {
              setShowTest((v) => !v)
              setPage(1)
            }}
            data-cms-key="admin.bookings.show_test"
            title="顯示測試預約"
          />
          <span className="admin-sub" data-cms-key="admin.bookings.show_test_label">
            顯示測試預約
          </span>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="admin-btn primary"
            data-cms-key="admin.bookings.manual_cta"
          >
            <Plus size={18} aria-hidden />
            手動新增預約
          </button>
        </div>
      </div>

      {/* ── Toolbar: search / status / from / to ───────────────────── */}
      <div className="admin-toolbar">
        <div className="admin-field">
          <label htmlFor="bk-q">搜尋</label>
          <input
            id="bk-q"
            type="search"
            value={search}
            placeholder="例：6128 4501 / S80001 / K7M2Q9"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            data-cms-key="admin.bookings.search"
          />
        </div>
        <div className="admin-field">
          <label htmlFor="bk-st">狀態</label>
          <select
            id="bk-st"
            className="admin-sel"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label htmlFor="bk-f">由</label>
          <input
            id="bk-f"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="admin-field">
          <label htmlFor="bk-t">至</label>
          <input
            id="bk-t"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      <section className="admin-card flat" aria-busy={loading}>
        <div className="admin-list">
          <div className="admin-li admin-li-bk hd">
            <span className="admin-c-hc">預約碼</span>
            <span className="admin-c-nm">客人</span>
            <span className="admin-c-dt">日期與時間</span>
            <span className="admin-c-tb">枱</span>
            <span className="admin-c-pr">金額</span>
            <span className="admin-c-st">狀態</span>
          </div>

          {rows.length ? (
            rows.map((b) => {
              const [label, tone] = statusOf(b.status)
              return (
                <button
                  type="button"
                  key={b.id}
                  className="admin-li admin-li-bk"
                  onClick={() => setSelectedBookingId(b.id)}
                  data-cms-key="admin.bookings.row"
                >
                  <span className="admin-c-hc">
                    {/* Prototype `.c-hc`: short reference on top, `S8-…` below. */}
                    <span className="mono">{b.bookingReference ?? b.humanCode ?? '—'}</span>
                    <br />
                    <span className="admin-cell-sub mono">{b.humanCode ?? '—'}</span>
                  </span>
                  <span className="admin-c-nm">
                    <span className="admin-cell-main">
                      {b.userName ?? '—'}
                      {b.isTest ? (
                        <>
                          {' '}
                          <span className="admin-tag warn">測試</span>
                        </>
                      ) : null}
                    </span>
                    <br />
                    <span className="admin-cell-sub">{formatPhone(b.userPhone)}</span>
                  </span>
                  <span className="admin-c-dt">
                    <span className="admin-cell-main">{dateLabel(b.date)}</span>
                    <br />
                    <span className="admin-cell-sub mono">
                      {b.startTime ?? '—'}–{b.endTime ?? '—'}
                      <span className="tbi"> · 枱 {b.tableNumber}</span>
                    </span>
                  </span>
                  <span className="admin-c-tb">{b.tableNumber}</span>
                  <span className="admin-c-pr num">{money(b.price)}</span>
                  <span className="admin-c-st">
                    <span className={`admin-pill ${tone}`}>{label}</span>
                  </span>
                </button>
              )
            })
          ) : (
            <div
              className="admin-empty"
              role={data.error || loadError ? 'alert' : undefined}
              data-cms-key="admin.bookings.empty_or_error"
              style={data.error || loadError ? { color: 'var(--admin-danger, #f87171)' } : undefined}
            >
              {loadError ?? data.error ?? (loading ? '搜尋中…' : '找不到符合條件的預約')}
            </div>
          )}
        </div>

        <div className="admin-pager">
          <span>共 {data.total} 筆</span>
          <span className="admin-row">
            <button
              type="button"
              className="admin-btn sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一頁
            </button>
            <span className="num">
              {page} / {pages}
            </span>
            <button
              type="button"
              className="admin-btn sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              下一頁
            </button>
          </span>
        </div>
      </section>

      <BookingDrawer
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {showWizard && (
        <ManualBookingWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => {
            setShowWizard(false)
            setRefreshKey((k) => k + 1)
            void router.refresh()
          }}
        />
      )}
    </>
  )
}

function isApiResponse(value: unknown): value is ApiResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return Array.isArray(v.bookings) && typeof v.total === 'number'
}
