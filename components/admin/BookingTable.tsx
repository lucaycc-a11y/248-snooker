'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'
import type { AdminBookingRow } from '@/lib/data/getAdminBookings'

type ApiResponse = { bookings: AdminBookingRow[]; total: number; page: number; pageSize: number }

const STATUS_OPTIONS = ['', 'pending', 'confirmed', 'refunded']

function statusColor(status: string): string {
  if (status === 'confirmed') return tokens.colors.brand
  if (status === 'pending') return '#eab308'
  if (status === 'refunded') return tokens.colors.danger
  return tokens.colors.textMuted
}

export default function BookingTable({ initial }: { initial: ApiResponse }) {
  const [data, setData] = useState(initial)
  const [page, setPage] = useState(initial.page)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchPage = useCallback((p: number, s: string, q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s) params.set('status', s)
    if (q) params.set('search', q)
    fetch(`/api/admin/bookings?${params.toString()}`)
      .then((res) => res.json())
      .then((json: ApiResponse) => {
        setData(json)
        setPage(json.page)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchPage(1, status, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div>
      <div style={{ display: 'flex', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 200 }}>
          <Input
            placeholder="Search booking reference"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchPage(1, status, search)
            }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{
            height: 52,
            padding: '0 14px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: tokens.radius.input,
            color: tokens.colors.text,
            fontSize: 15,
          }}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <Button variant="secondary" size="md" onClick={() => fetchPage(1, status, search)} loading={loading}>
          Search
        </Button>
      </div>

      <Card padding="0">
        {data.bookings.map((b, i) => (
          <Link
            key={b.id}
            href={`/admin/bookings/${b.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacing.md,
              padding: tokens.spacing.base,
              borderBottom: i === data.bookings.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
              textDecoration: 'none',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>
                {b.bookingReference ?? b.id.slice(0, 8)}
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
                {b.userName ?? b.userEmail ?? 'Guest'} · Table {b.tableNumber} · {b.date} {b.startTime}-{b.endTime}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>HK${b.price}</div>
              <div style={{ color: statusColor(b.status), fontSize: 13 }}>{b.status}</div>
            </div>
          </Link>
        ))}
        {data.bookings.length === 0 && (
          <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>
            No bookings found.
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: tokens.spacing.md }}>
        <span style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
          Page {page} of {totalPages} · {data.total} total
        </span>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => fetchPage(page - 1, status, search)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => fetchPage(page + 1, status, search)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
