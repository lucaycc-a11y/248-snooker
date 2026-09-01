'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'
import type { AdminMemberRow } from '@/lib/data/getAdminMembers'

type ApiResponse = { members: AdminMemberRow[]; total: number; page: number; pageSize: number }

export default function MemberTable({ initial }: { initial: ApiResponse }) {
  const [data, setData] = useState(initial)
  const [page, setPage] = useState(initial.page)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchPage = useCallback((p: number, q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('search', q)
    fetch(`/api/admin/users?${params.toString()}`)
      .then((res) => res.json())
      .then((json: ApiResponse) => {
        setData(json)
        setPage(json.page)
      })
      .finally(() => setLoading(false))
  }, [])

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return (
    <div>
      <div style={{ display: 'flex', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <Input
            placeholder="Search email, phone, or member code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchPage(1, search)
            }}
          />
        </div>
        <Button variant="secondary" size="md" onClick={() => fetchPage(1, search)} loading={loading}>
          Search
        </Button>
      </div>

      <Card padding="0">
        {data.members.map((m, i) => (
          <Link
            key={m.id}
            href={`/admin/members/${m.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: tokens.spacing.md,
              padding: tokens.spacing.base,
              borderBottom: i === data.members.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
              textDecoration: 'none',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>
                {m.displayName ?? m.email ?? m.memberCode ?? m.id.slice(0, 8)}
              </div>
              <div style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
                {m.memberCode ?? '—'} · {m.tier ?? 'amateur'} · {m.bookingCount} bookings
              </div>
            </div>
            <div style={{ textAlign: 'right', color: tokens.colors.text, fontSize: 15, fontWeight: 600 }}>
              HK${m.totalSpend}
            </div>
          </Link>
        ))}
        {data.members.length === 0 && (
          <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>
            No members found.
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: tokens.spacing.md }}>
        <span style={{ color: tokens.colors.textMuted, fontSize: 13 }}>
          Page {page} of {totalPages} · {data.total} total
        </span>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => fetchPage(page - 1, search)}>
            Previous
          </Button>
          <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => fetchPage(page + 1, search)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
