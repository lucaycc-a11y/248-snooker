/**
 * Admin Members page — card grid view (spec §9.1).
 *
 * Server component shell: fetches member data, renders MemberCardGrid.
 * Design system: admin-theme.css variables only — no inline hex, no shadows.
 * Tier naming: Nova (amateur), Platinum (century), Diamond (maximum).
 */

import { getAdminMembers } from '@/lib/data/getAdminMembers'
import MemberCardGrid from '@/components/admin/MemberCardGrid'

export default async function AdminMembersPage() {
  const result = await getAdminMembers({ page: 1 })

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-1.5">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin.members.title"
        >
          Members
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
          data-cms-key="admin.members.subtitle"
        >
          Manage member profiles, tiers, and activity.
        </p>
      </header>

      {/* Stats bar */}
      <div
        className="flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3 text-sm"
        style={{
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
          color: 'var(--admin-text-muted)',
        }}
      >
        <span>
          <strong style={{ color: 'var(--admin-text)' }}>{result.total}</strong> total members
        </span>
        <span
          className="h-4 w-px"
          style={{ background: 'var(--admin-border)' }}
          aria-hidden="true"
        />
        <span>
          <strong style={{ color: 'var(--admin-brand)' }}>
            {result.members.filter((m) => m.tier === 'maximum').length}
          </strong>{' '}
          Diamond
        </span>
        <span>
          <strong style={{ color: 'var(--admin-tier-platinum)' }}>
            {result.members.filter((m) => m.tier === 'century').length}
          </strong>{' '}
          Platinum
        </span>
        <span>
          <strong style={{ color: 'var(--admin-tier-nova)' }}>
            {result.members.filter((m) => m.tier === 'amateur').length}
          </strong>{' '}
          Nova
        </span>
      </div>

      {/* Card grid */}
      <MemberCardGrid members={result.members} />

      {/* Pagination placeholder */}
      {result.total > result.page * result.pageSize && (
        <div
          className="text-center text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
          data-cms-key="admin.members.pagination_note"
        >
          Showing first {result.members.length} of {result.total} members.
        </div>
      )}
    </main>
  )
}
