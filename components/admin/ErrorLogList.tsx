'use client'

import { useState } from 'react'

export type SiteErrorRow = {
  id: string
  source: string | null
  severity: string | null
  message: string | null
  resolved: boolean | null
  created_at: string | null
}

const SEVERITY_STYLE: Record<string, { label: string; color: string }> = {
  error: { label: 'error', color: 'var(--admin-status-danger)' },
  warning: { label: 'warn', color: 'var(--admin-status-warning)' },
  warn: { label: 'warn', color: 'var(--admin-status-warning)' },
  info: { label: 'info', color: 'var(--admin-text-secondary)' },
}

type Filter = 'open' | 'all'

export default function ErrorLogList({ rows }: { rows: SiteErrorRow[] }) {
  const [filter, setFilter] = useState<Filter>('open')
  const [items, setItems] = useState(rows)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = filter === 'open' ? items.filter((r) => !r.resolved) : items

  async function markResolved(id: string, resolved: boolean) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/errors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      })
      if (!res.ok) return
      setItems((prev) => prev.map((r) => (r.id === id ? { ...r, resolved } : r)))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="group" aria-label="篩選">
        {(
          [
            ['open', '未解決'],
            ['all', '全部'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className="min-h-[36px] rounded-[var(--admin-radius-pill)] border px-4 text-sm"
            style={{
              borderColor: filter === key ? 'var(--admin-green)' : 'var(--admin-border-subtle)',
              color: filter === key ? 'var(--admin-green)' : 'var(--admin-text-secondary)',
              background: filter === key ? 'color-mix(in srgb, var(--admin-green) 12%, transparent)' : 'transparent',
            }}
            data-cms-key={`admin.errors.filter_${key}`}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        className="overflow-hidden rounded-[var(--admin-radius-card)] border"
        style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' }}
      >
        {visible.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.errors.empty">
            沒有未解決的錯誤
          </p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((row) => {
              const sev = SEVERITY_STYLE[row.severity ?? 'info'] ?? SEVERITY_STYLE.info
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start gap-3 border-t p-4 first:border-t-0"
                  style={{ borderColor: 'var(--admin-border-subtle)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-[var(--admin-radius-pill)] border px-2 py-0.5 text-xs"
                        style={{ borderColor: sev.color, color: sev.color }}
                      >
                        {sev.label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                        {row.source ?? 'unknown'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--admin-text-primary)' }}>
                      {row.message ?? '—'}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                      {row.created_at ?? ''}
                    </p>
                  </div>
                  {row.resolved ? (
                    <span
                      className="rounded-[var(--admin-radius-pill)] border px-2 py-0.5 text-xs"
                      style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-tertiary)' }}
                      data-cms-key="admin.errors.resolved"
                    >
                      已解決
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => markResolved(row.id, true)}
                      className="min-h-[36px] rounded-[var(--admin-radius-button)] border px-3 text-sm"
                      style={{
                        borderColor: 'var(--admin-border-subtle)',
                        color: 'var(--admin-text-secondary)',
                        opacity: busyId === row.id ? 0.5 : 1,
                      }}
                      data-cms-key="admin.errors.mark_resolved"
                    >
                      標記已解決
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
