'use client'

import { useCallback, useEffect, useState } from 'react'

export type MaintenanceBlock = {
  id: string
  date: string
  start_time: string | null
  end_time: string | null
  table_number: number | null
  reason: string | null
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseBlock(v: unknown): MaintenanceBlock | null {
  if (!isRecord(v)) return null
  if (typeof v.id !== 'string' || typeof v.date !== 'string') return null
  return {
    id: v.id,
    date: v.date,
    start_time: typeof v.start_time === 'string' ? v.start_time : null,
    end_time: typeof v.end_time === 'string' ? v.end_time : null,
    table_number: typeof v.table_number === 'number' ? v.table_number : null,
    reason: typeof v.reason === 'string' ? v.reason : null,
  }
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--admin-bg-elevated)',
  borderColor: 'var(--admin-border-subtle)',
  color: 'var(--admin-text-primary)',
  borderRadius: 'var(--admin-radius-input)',
  borderWidth: 1,
  minHeight: 44,
  padding: '0 12px',
}

export default function MaintenanceBlocks({ tableCount = 2 }: { tableCount?: number }) {
  const [blocks, setBlocks] = useState<MaintenanceBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState('')
  const [table, setTable] = useState('0')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/maintenance-log')
      if (!res.ok) return
      const json: unknown = await res.json()
      if (isRecord(json) && Array.isArray(json.blocks)) {
        setBlocks(json.blocks.map(parseBlock).filter((b): b is MaintenanceBlock => b !== null))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function addBlock() {
    setError(null)
    if (!date) {
      setError('請填寫日期')
      return
    }
    if ((start && !end) || (!start && end)) {
      setError('開始與結束時間必須同時填寫（或留空表示全日）')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/maintenance-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          table_number: table === '0' ? null : Number(table),
          start_time: start || null,
          end_time: end || null,
          reason: reason.trim() || null,
        }),
      })
      const json: unknown = await res.json()
      if (!res.ok) {
        setError(isRecord(json) && typeof json.error === 'string' ? json.error : '儲存失敗')
        return
      }
      setDate('')
      setTable('0')
      setStart('')
      setEnd('')
      setReason('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function removeBlock(id: string) {
    setError(null)
    const res = await fetch(`/api/admin/maintenance-log/${id}`, { method: 'DELETE' })
    if (res.ok) await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-[var(--admin-radius-card)] border p-5"
        style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--admin-text-primary)' }} data-cms-key="admin.maint.add_title">
          新增封枱
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.maint.date">日期</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.maint.table">枱號</span>
            <select value={table} onChange={(e) => setTable(e.target.value)} style={fieldStyle}>
              <option value="0">全部枱</option>
              {Array.from({ length: tableCount }, (_, i) => i + 1).map((t) => (
                <option key={t} value={String(t)}>
                  枱 {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.maint.reason">原因</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例：更換枱布"
              style={fieldStyle}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.maint.start">開始（留空為全日）</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={fieldStyle} />
          </label>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
            <span data-cms-key="admin.maint.end">結束</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={fieldStyle} />
          </label>
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--admin-status-danger)' }}>
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => void addBlock()}
          disabled={saving}
          className="mt-4 min-h-[44px] rounded-[var(--admin-radius-button)] px-5 text-sm font-semibold"
          style={{
            background: saving ? 'var(--admin-green-deep)' : 'var(--admin-green)',
            color: 'var(--admin-brand-text)',
            opacity: saving ? 0.6 : 1,
          }}
          data-cms-key="admin.maint.add_submit"
        >
          {saving ? '儲存中…' : '新增封枱'}
        </button>
      </section>

      <section
        className="overflow-hidden rounded-[var(--admin-radius-card)] border"
        style={{ borderColor: 'var(--admin-border-subtle)', background: 'var(--admin-bg-surface)' }}
      >
        <h2
          className="border-b px-5 py-4 text-base font-semibold"
          style={{ borderColor: 'var(--admin-border-subtle)', color: 'var(--admin-text-primary)' }}
          data-cms-key="admin.maint.list_title"
        >
          封枱記錄
        </h2>
        {loading ? (
          <p className="p-5 text-sm" style={{ color: 'var(--admin-text-tertiary)' }}>
            載入中…
          </p>
        ) : blocks.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'var(--admin-text-tertiary)' }} data-cms-key="admin.maint.empty">
            沒有封枱記錄
          </p>
        ) : (
          <ul className="flex flex-col">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 border-t px-5 py-4 first:border-t-0"
                style={{ borderColor: 'var(--admin-border-subtle)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm" style={{ color: 'var(--admin-text-primary)' }}>
                    {b.date} · {b.table_number ? `枱 ${b.table_number}` : '全部枱'} ·{' '}
                    {b.start_time && b.end_time ? `${b.start_time}–${b.end_time}` : '全日'}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-tertiary)' }}>
                    {b.reason ?? '未填原因'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeBlock(b.id)}
                  className="min-h-[36px] rounded-[var(--admin-radius-button)] border px-3 text-sm"
                  style={{ borderColor: 'var(--admin-status-danger)', color: 'var(--admin-status-danger)' }}
                  data-cms-key="admin.maint.remove"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
