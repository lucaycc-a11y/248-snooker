/**
 * Admin Members page — card grid view (spec §9.1).
 *
 * Server component shell: fetches member data, renders MemberCardGrid.
 * Design system: admin-theme.css variables only — no inline hex, no shadows.
 * Tier naming: Nova (amateur), Platinum (century), Diamond (maximum).
 */

import Link from 'next/link'
import { getAdminMembers } from '@/lib/data/getAdminMembers'
import { tierShortLabel } from '@/lib/member/tierDisplay'
import MemberCardGrid from '@/components/admin/MemberCardGrid'
import AccountFlagsList from '@/components/admin/AccountFlagsList'

type SearchParams = { tab?: string }

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const activeTab = searchParams?.tab === 'flags' ? 'flags' : 'members'
  const result = await getAdminMembers({ page: 1 })

  const tabLink = (key: 'members' | 'flags', label: string, cmsKey: string) => {
    const href = key === 'members' ? '/admin/members' : '/admin/members?tab=flags'
    const isActive = activeTab === key
    return (
      <Link
        key={key}
        href={href}
        className="rounded-xl px-3 py-2 text-xs font-semibold transition-colors"
        style={{
          color: isActive ? 'var(--admin-brand)' : 'var(--admin-text-muted)',
          background: isActive ? 'var(--admin-brand-dim)' : 'transparent',
          border: isActive
            ? '1px solid var(--admin-brand)'
            : '1px solid var(--admin-border)',
        }}
        data-cms-key={cmsKey}
      >
        {label}
      </Link>
    )
  }

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

      {/* Tabs — Members | 帳戶異常 (see lib/admin/nav.ts) */}
      <nav className="flex flex-wrap gap-2">
        {tabLink('members', '會員列表', 'admin.members.tab_members')}
        {tabLink('flags', '帳戶異常', 'admin.members.tab_flags')}
      </nav>

      {activeTab === 'flags' ? (
        <AccountFlagsList />
      ) : (
        <>
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
              {tierShortLabel('maximum')}
            </span>
            <span>
              <strong style={{ color: 'var(--admin-tier-platinum)' }}>
                {result.members.filter((m) => m.tier === 'century').length}
              </strong>{' '}
              {tierShortLabel('century')}
            </span>
            <span>
              <strong style={{ color: 'var(--admin-tier-nova)' }}>
                {result.members.filter((m) => m.tier === 'amateur').length}
              </strong>{' '}
              {tierShortLabel('amateur')}
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
        </>
      )}
    </main>
  )
}
