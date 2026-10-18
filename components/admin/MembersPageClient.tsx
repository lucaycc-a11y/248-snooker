'use client'

/**
 * MembersPageClient — the prototype's `vMembers()` + `memResults()`.
 *
 * Head: 會員 / 所有會員資料更改都會自動發送 inbox 通知, plus the 會員列表|帳戶異常
 * segmented control. List view: search + 全部|黑名單|待重新驗證電話 + 卡片|表格.
 *
 * Filtering is client-side and mirrors `memFilter()` exactly — the query is
 * lowercased with all whitespace stripped, then matched against name, phone,
 * code and email joined by spaces. `preview` freezes the incoming rows and
 * skips navigation, so the unauthenticated harness can be diffed against
 * /tmp/admin-ref/*-08-members-grid.png.
 */

import { useEffect, useMemo, useState } from 'react'
import { type AdminMemberRow } from '@/lib/data/getAdminMembers'
import { money } from '@/lib/admin/today'
import MemberCardGrid from './MemberCardGrid'
import MemberDetailSheet from './MemberDetailSheet'

type MemFilter = 'all' | 'bl' | 'rv'
type MemView = 'grid' | 'table'

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { key: T; label: string; cmsKey: string }[]
  onChange: (next: T) => void
  label: string
}) {
  return (
    <div className="admin-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          data-cms-key={o.cmsKey}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type Props = {
  members: AdminMemberRow[]
  /**
   * Loader failure message. When set the list is NOT an empty result — show a
   * banner with this text instead of 找不到會員.
   */
  error?: string | null
  /** Renders for the 帳戶異常 tab. The real page passes <AccountFlagsList />. */
  flagsSlot?: React.ReactNode
  /** Gates the 修改電話與電郵 row in the detail sheet. */
  isSuperAdmin?: boolean
  /** Harness only: freeze rows and open detail inline instead of navigating. */
  preview?: boolean
  onOpen?: (id: string) => void
}

export default function MembersPageClient({
  members,
  error,
  flagsSlot,
  isSuperAdmin = false,
  preview,
  onOpen,
}: Props) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<MemFilter>('all')
  const [view, setView] = useState<MemView>('grid')
  const [tab, setTab] = useState<'list' | 'flags'>('list')
  const [openId, setOpenId] = useState<string | null>(null)
  const [includeHidden, setIncludeHidden] = useState(false)
  const [rowsData, setRowsData] = useState<AdminMemberRow[]>(members)
  const [loadError, setLoadError] = useState<string | null>(error ?? null)

  // 「顯示隱藏帳戶」 re-fetches through the shared loader rather than
  // re-filtering the rows already in memory — hidden accounts must never be
  // excluded (or included) by the browser.
  useEffect(() => {
    setRowsData(members)
    setLoadError(error ?? null)
  }, [members, error])

  // Search + 「顯示隱藏帳戶」 both go to the server (shared loader), debounced,
  // with the previous request aborted so a slow answer can never overwrite a
  // newer one. The initial page-1 list from the server component is used as-is
  // while no search / toggle is active.
  const [searching, setSearching] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    const term = q.trim()
    if (!term && !includeHidden) {
      setRowsData(members)
      setLoadError(error ?? null)
      setTotal(null)
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      const params = new URLSearchParams({ page: '1' })
      if (term) params.set('search', term)
      if (includeHidden) params.set('includeHidden', 'true')
      fetch(`/api/admin/users?${params.toString()}`, { signal: ctrl.signal })
        .then(async (res) => {
          const json = (await res.json().catch(() => ({}))) as {
            error?: string
            members?: AdminMemberRow[]
            total?: number
          }
          if (!res.ok || json.error) {
            setLoadError(json.error ?? '會員資料載入失敗')
            return
          }
          setLoadError(null)
          setRowsData(json.members ?? [])
          setTotal(json.total ?? null)
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setLoadError(e instanceof Error ? e.message : '會員資料載入失敗')
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setSearching(false)
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, includeHidden, members, error])

  const rows = useMemo(
    () =>
      rowsData.filter((m) => {
        if (filter === 'bl' && !m.isBlacklisted) return false
        if (filter === 'rv' && !m.needsManualPhoneReverify) return false
        return true
      }),
    [rowsData, filter],
  )

  const open = (id: string) => {
    // Prototype `open-mem` opens the drawer in place. The detail sheet is
    // driven off list rows, so no navigation is required to show 資料.
    setOpenId(id)
    if (preview && onOpen) onOpen(id)
  }

  const openMember = openId ? rowsData.find((m) => m.id === openId) : null

  return (
    <>
      {/* Page-level head (prototype `.head`): title/sub left, seg right. No
          padding and no rule — `.admin-head` is the in-card variant. */}
      <div className="admin-page-head">
        <div>
          <h2 data-cms-key="admin.members.title">會員</h2>
          <p className="admin-sub" data-cms-key="admin.members.subtitle">
            所有會員資料更改都會自動發送 inbox 通知
          </p>
        </div>
        <Seg
          value={tab}
          onChange={setTab}
          label="會員分頁"
          options={[
            { key: 'list', label: '會員列表', cmsKey: 'admin.members.tab_members' },
            { key: 'flags', label: '帳戶異常', cmsKey: 'admin.members.tab_flags' },
          ]}
        />
      </div>

      {tab === 'flags' ? (
        flagsSlot ?? (
          <section className="admin-card flat">
            <div className="admin-empty" data-cms-key="admin.members.flags_empty">
              沒有帳戶異常
            </div>
          </section>
        )
      ) : (
        <>
          <div className="admin-row">
            <div className="admin-field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="mem-q" data-cms-key="admin.members.search_label">
                搜尋
              </label>
              <input
                id="mem-q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="電話、會員編號、名稱、電郵"
                data-cms-key="admin.members.search_placeholder"
              />
            </div>
            <Seg
              value={filter}
              onChange={setFilter}
              label="會員篩選"
              options={[
                { key: 'all', label: '全部', cmsKey: 'admin.members.filter_all' },
                { key: 'bl', label: '黑名單', cmsKey: 'admin.members.filter_bl' },
                {
                  key: 'rv',
                  label: '待重新驗證電話',
                  cmsKey: 'admin.members.filter_rv',
                },
              ]}
            />
            <Seg
              value={view}
              onChange={setView}
              label="顯示方式"
              options={[
                { key: 'grid', label: '卡片', cmsKey: 'admin.members.view_grid' },
                { key: 'table', label: '表格', cmsKey: 'admin.members.view_table' },
              ]}
            />
            <label className="admin-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={includeHidden}
                onChange={(e) => setIncludeHidden(e.target.checked)}
                data-cms-key="admin.members.show_hidden"
              />
              <span data-cms-key="admin.members.show_hidden_label">顯示隱藏帳戶</span>
            </label>
          </div>

          <section className="admin-card flat" data-mv={view}>
            {loadError ? (
              <div
                className="admin-empty"
                role="alert"
                data-cms-key="admin.members.error"
                style={{ color: 'var(--admin-danger, #f87171)' }}
              >
                {loadError}
              </div>
            ) : rows.length === 0 ? (
              <div className="admin-empty" data-cms-key="admin.members.empty">
                找不到會員
              </div>
            ) : view === 'grid' ? (
              <MemberCardGrid members={rows} onOpen={preview ? open : undefined} />
            ) : (
              <div className="admin-list">
                {rows.map((m) => {
                  const name = m.displayName || m.memberCode || m.email || m.id.slice(0, 8)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className="admin-li admin-li-mem"
                      onClick={() => open(m.id)}
                    >
                      <span>
                        <span className="admin-cell-main">{name}</span>
                        <br />
                        <span className="admin-cell-sub admin-mono">{m.memberCode ?? ''}</span>
                      </span>
                      <span className="admin-cell-sub">
                        {m.phone ?? ''}
                        <br />
                        {m.email || '沒有電郵'}
                      </span>
                      <span className="admin-num">{m.points} 分</span>
                      <span className="admin-num">{money(m.credits)}</span>
                      <span>
                        {m.isBlacklisted ? (
                          <span className="admin-tag bad" data-cms-key="admin.members.badge_blacklist">
                            黑名單
                          </span>
                        ) : null}
                        {m.needsManualPhoneReverify ? (
                          <span className="admin-tag warn" data-cms-key="admin.members.badge_reverify">
                            待重新驗證電話
                          </span>
                        ) : null}
                        {m.isHidden ? (
                          <span className="admin-tag warn" data-cms-key="admin.members.badge_hidden">
                            已隱藏
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="admin-pager">
              <span data-cms-key="admin.members.pager">
                {searching ? '搜尋中…' : total !== null && total > rows.length ? `顯示 ${rows.length} / 共 ${total} 位（請輸入更多字元縮窄範圍）` : `共 ${rows.length} 位`}
              </span>
            </div>
          </section>
        </>
      )}

      {openMember ? (
        <MemberDetailSheet
          member={openMember}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  )
}
