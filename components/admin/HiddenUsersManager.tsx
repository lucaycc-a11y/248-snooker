'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HiddenUserRow } from '@/lib/data/getHiddenUserIds'

// 系統 → 「隱藏帳戶」. Super-admin only to change; every mutation goes through
// /api/admin/hidden-users, which writes audit_log. Hidden accounts are filtered
// out of every list and total in the shared loaders — this page is where you
// manage that list.

type SearchHit = {
  id: string
  email: string | null
  displayName: string | null
  memberCode: string | null
}

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: HiddenUserRow[] }

function labelOf(u: { email: string | null; displayName: string | null; memberCode: string | null }): string {
  return u.displayName ?? u.email ?? u.memberCode ?? '—'
}

export default function HiddenUsersManager({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<ListState>({ kind: 'loading' })
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(async () => {
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/api/admin/hidden-users')
      const json = (await res.json()) as { error?: string; hidden?: HiddenUserRow[] }
      if (!res.ok || json.error) {
        setState({ kind: 'error', message: json.error ?? '隱藏帳戶清單載入失敗' })
        return
      }
      setState({ kind: 'ready', rows: json.hidden ?? [] })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : '隱藏帳戶清單載入失敗' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  async function runSearch() {
    const term = search.trim()
    if (term.length < 2) {
      setHits([])
      return
    }
    setSearching(true)
    setFailure(null)
    try {
      // Default (includeHidden absent) already excludes hidden accounts, so
      // every hit here is addable.
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(term)}&page=1`)
      const json = (await res.json()) as {
        error?: string
        members?: { id: string; email: string | null; displayName: string | null; memberCode: string | null }[]
      }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '搜尋失敗')
        setHits([])
        return
      }
      setHits(
        (json.members ?? []).map((m) => ({
          id: m.id,
          email: m.email,
          displayName: m.displayName,
          memberCode: m.memberCode,
        })),
      )
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '搜尋失敗')
      setHits([])
    } finally {
      setSearching(false)
    }
  }

  async function mutate(body: Record<string, unknown>, okMessage: string) {
    setBusy(true)
    setFailure(null)
    setNotice(null)
    try {
      const res = await fetch('/api/admin/hidden-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string; added?: number; skipped?: number }
      if (!res.ok || json.error) {
        setFailure(json.error ?? '操作失敗')
        return
      }
      if (typeof json.added === 'number') {
        setNotice(`${okMessage}（新增 ${json.added} 個，略過 ${json.skipped ?? 0} 個）`)
      } else {
        setNotice(okMessage)
      }
      await load()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : '操作失敗')
    } finally {
      setBusy(false)
    }
  }

  const reasonOk = reason.trim().length >= 5

  return (
    <div className="flex flex-col gap-6">
      {(failure || notice) && (
        <div
          role={failure ? 'alert' : 'status'}
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            border: `1px solid ${failure ? 'var(--admin-danger)' : 'var(--admin-brand)'}`,
            color: failure ? 'var(--admin-danger)' : 'var(--admin-brand)',
          }}
        >
          {failure ?? notice}
        </div>
      )}

      {canManage ? (
        <section
          className="flex flex-col gap-3 rounded-2xl p-4"
          style={{ border: '1px solid var(--admin-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }} data-cms-key="admin.hidden_users.add_title">
            加入隱藏帳戶
          </h2>
          <p className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.hidden_users.add_hint">
            搜尋電郵、電話或會員編號。隱藏後，該帳戶不會出現在任何列表或合計中。
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch()
              }}
              placeholder="電郵／電話／會員編號"
              data-cms-key="admin.hidden_users.search_placeholder"
              className="min-w-[220px] flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)' }}
            />
            <button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching || search.trim().length < 2}
              className="rounded-xl px-4 py-2 text-sm font-medium"
              style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', opacity: searching ? 0.5 : 1 }}
              data-cms-key="admin.hidden_users.search"
            >
              {searching ? '搜尋中…' : '搜尋'}
            </button>
          </div>

          {hits.length > 0 && (
            <ul className="flex flex-col gap-2">
              {hits.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2"
                  style={{ border: '1px solid var(--admin-border)' }}
                >
                  <div className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>
                    {labelOf(h)}
                    <span className="ml-2 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                      {h.memberCode ?? h.email ?? h.id.slice(0, 8)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !reasonOk}
                    onClick={() =>
                      void mutate({ action: 'add', userId: h.id, reason: reason.trim() }, '已加入隱藏清單')
                    }
                    className="rounded-xl px-3 py-1.5 text-xs font-medium"
                    style={{
                      border: '1px solid var(--admin-danger)',
                      color: 'var(--admin-danger)',
                      opacity: busy || !reasonOk ? 0.5 : 1,
                    }}
                    data-cms-key="admin.hidden_users.add"
                  >
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}

          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.hidden_users.reason_label">原因（至少 5 個字）</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例如：內部測試帳戶"
              data-cms-key="admin.hidden_users.reason_placeholder"
              className="rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)' }}
            />
          </label>

          <button
            type="button"
            disabled={busy || !reasonOk}
            onClick={() =>
              void mutate({ action: 'add_all_admins', reason: reason.trim() }, '已加入所有管理員帳戶')
            }
            className="self-start rounded-xl px-4 py-2 text-sm font-medium"
            style={{
              border: '1px solid var(--admin-border)',
              color: 'var(--admin-text-primary)',
              opacity: busy || !reasonOk ? 0.5 : 1,
            }}
            data-cms-key="admin.hidden_users.add_all_admins"
          >
            加入所有管理員帳戶
          </button>
        </section>
      ) : (
        <div
          className="rounded-2xl px-4 py-3 text-sm"
          style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-tertiary)' }}
          data-cms-key="admin.hidden_users.read_only"
        >
          只有超級管理員可變更隱藏帳戶。
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--admin-text-primary)' }} data-cms-key="admin.hidden_users.list_title">
          目前隱藏的帳戶
        </h2>

        {state.kind === 'loading' && (
          <div className="text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.hidden_users.loading">
            載入中…
          </div>
        )}

        {state.kind === 'error' && (
          <div
            role="alert"
            className="rounded-xl px-4 py-3 text-sm"
            style={{ border: '1px solid var(--admin-danger)', color: 'var(--admin-danger)' }}
          >
            {state.message}
          </div>
        )}

        {state.kind === 'ready' && state.rows.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.hidden_users.empty">
            沒有隱藏帳戶。
          </div>
        )}

        {state.kind === 'ready' && state.rows.length > 0 && (
          <ul className="flex flex-col gap-2">
            {state.rows.map((row) => (
              <li
                key={row.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2"
                style={{ border: '1px solid var(--admin-border)' }}
              >
                <div className="min-w-0">
                  <div className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>
                    {labelOf(row)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                    {row.memberCode ?? row.email ?? row.userId.slice(0, 8)}
                    {row.reason ? ` · ${row.reason}` : ''}
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        { action: 'remove', userId: row.userId, reason: reason.trim() || '移出隱藏清單' },
                        '已移出隱藏清單',
                      )
                    }
                    className="rounded-xl px-3 py-1.5 text-xs font-medium"
                    style={{ border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', opacity: busy ? 0.5 : 1 }}
                    data-cms-key="admin.hidden_users.remove"
                  >
                    移出
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
