'use client'

/**
 * AccountFlagsList — 會員 → 帳戶異常.
 *
 * Lists shared-IP / shared-device groupings derived from auth_risk_events.
 * "重新整理" recomputes the groupings at read time; "已處理" marks a flag reviewed.
 *
 * CSS-variable only — no inline hex, no shadows.
 */

import { useState, useCallback, useEffect } from 'react'
import { Loader2, RefreshCw, ShieldAlert, Check, Undo2 } from 'lucide-react'
import { useAdminToast } from '@/components/admin/ToastProvider'

type AccountFlagRow = {
  id: string
  flag_type: 'shared_ip' | 'shared_device'
  flag_key: string
  member_ids: string[]
  event_count: number
  first_seen: string | null
  last_seen: string | null
  status: 'open' | 'reviewed'
  reviewed_at: string | null
}

type Props = {
  /** Injected by a server component so the first paint is not a loading spinner. */
  initialFlags?: AccountFlagRow[]
}

const TYPE_LABEL: Record<AccountFlagRow['flag_type'], string> = {
  shared_ip: '共用 IP',
  shared_device: '共用裝置',
}

export default function AccountFlagsList({ initialFlags = [] }: Props) {
  const toast = useAdminToast()
  const [flags, setFlags] = useState<AccountFlagRow[]>(initialFlags)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (status: 'open' | 'all') => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/account-flags?status=${status}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? '載入失敗')
      setFlags(Array.isArray(data?.flags) ? data.flags : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filter)
  }, [filter, load])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/account-flags', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? '重新整理失敗')
      await load(filter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRefreshing(false)
    }
  }, [filter, load])

  const handleReview = useCallback(
    async (id: string, reviewed: boolean) => {
      try {
        const res = await fetch(`/api/admin/account-flags/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewed }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error ?? '更新失敗')
        await load(filter)

        if (reviewed) {
          toast.show({
            message: '已標記為處理完畢',
            tone: 'success',
            onUndo: async () => {
              await fetch(`/api/admin/account-flags/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reviewed: false }),
              })
              await load(filter)
            },
          })
        } else {
          toast.show({ message: '已重開此旗標', tone: 'success' })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        toast.show({ message, tone: 'error' })
      }
    },
    [filter, load, toast],
  )

  const pillStyle = (type: AccountFlagRow['flag_type']): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    borderRadius: '999px',
    padding: '0.125rem 0.5rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    border: '1px solid var(--admin-border)',
    color: type === 'shared_device' ? 'var(--admin-warning)' : 'var(--admin-danger)',
    background: 'transparent',
  })

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    borderRadius: 'var(--admin-radius-btn)',
    border: '1px solid var(--admin-border)',
    background: 'transparent',
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--admin-text-muted)',
    cursor: 'pointer',
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('open')}
          style={{
            ...btnStyle,
            color: filter === 'open' ? 'var(--admin-brand)' : 'var(--admin-text-muted)',
            borderColor: filter === 'open' ? 'var(--admin-brand)' : 'var(--admin-border)',
          }}
          data-cms-key="admin.flags.filter_open"
        >
          未處理
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          style={{
            ...btnStyle,
            color: filter === 'all' ? 'var(--admin-brand)' : 'var(--admin-text-muted)',
            borderColor: filter === 'all' ? 'var(--admin-brand)' : 'var(--admin-border)',
          }}
          data-cms-key="admin.flags.filter_all"
        >
          全部
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          style={{ ...btnStyle, opacity: refreshing ? 0.5 : 1 }}
          data-cms-key="admin.flags.refresh"
        >
          {refreshing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          重新整理
        </button>
      </div>

      {error && (
        <p className="mb-3 text-xs" style={{ color: 'var(--admin-danger)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div
          className="flex items-center justify-center py-10"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : flags.length === 0 ? (
        <div
          className="rounded-xl border py-10 text-center text-sm"
          style={{
            borderColor: 'var(--admin-border)',
            color: 'var(--admin-text-muted)',
          }}
          data-cms-key="admin.flags.empty"
        >
          沒有發現共用 IP／裝置的帳戶
        </div>
      ) : (
        <ul className="space-y-2">
          {flags.map((flag) => (
            <li
              key={flag.id}
              className="rounded-xl border px-4 py-3"
              style={{
                borderColor: 'var(--admin-border)',
                background: 'var(--admin-glass-bg)',
                opacity: flag.status === 'reviewed' ? 0.55 : 1,
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span style={pillStyle(flag.flag_type)}>
                  <ShieldAlert size={11} />
                  {TYPE_LABEL[flag.flag_type]}
                </span>
                <code
                  className="text-xs"
                  style={{ color: 'var(--admin-text)', wordBreak: 'break-all' }}
                >
                  {flag.flag_key}
                </code>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => handleReview(flag.id, flag.status !== 'reviewed')}
                  style={btnStyle}
                  data-cms-key={
                    flag.status === 'reviewed' ? 'admin.flags.reopen' : 'admin.flags.review'
                  }
                >
                  {flag.status === 'reviewed' ? (
                    <>
                      <Undo2 size={12} />
                      重開
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      已處理
                    </>
                  )}
                </button>
              </div>

              <div
                className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
                style={{ color: 'var(--admin-text-muted)' }}
              >
                <span data-cms-key="admin.flags.member_count">
                  會員數：{flag.member_ids.length}
                </span>
                <span data-cms-key="admin.flags.event_count">
                  事件數：{flag.event_count}
                </span>
                {flag.first_seen && (
                  <span data-cms-key="admin.flags.first_seen">
                    首次：{flag.first_seen}
                  </span>
                )}
                {flag.last_seen && (
                  <span data-cms-key="admin.flags.last_seen">
                    最近：{flag.last_seen}
                  </span>
                )}
              </div>

              {flag.member_ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {flag.member_ids.slice(0, 8).map((id) => (
                    <span
                      key={id}
                      className="rounded px-1.5 py-0.5 text-[10px]"
                      style={{
                        background: 'var(--admin-bg)',
                        border: '1px solid var(--admin-border)',
                        color: 'var(--admin-text-muted)',
                      }}
                    >
                      {id.slice(0, 8)}
                    </span>
                  ))}
                  {flag.member_ids.length > 8 && (
                    <span
                      className="px-1.5 py-0.5 text-[10px]"
                      style={{ color: 'var(--admin-text-muted)' }}
                    >
                      +{flag.member_ids.length - 8}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
