'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'
import type { SiteGateLogRow } from '@/lib/data/getAdminSiteGate'

type ToastState = { type: 'success' | 'error'; message: string }
type MethodFilter = 'all' | 'denied' | 'whitelist' | 'password'
type RangeFilter = 'today' | '7d' | '30d' | 'all'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorMessage(json: unknown, fallback: string): string {
  return isRecord(json) && typeof json.error === 'string' ? json.error : fallback
}

function methodColor(method: string): string {
  if (method === 'whitelist') return tokens.colors.brand
  if (method === 'password') return tokens.colors.link
  return tokens.colors.danger
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-HK', { dateStyle: 'medium', timeStyle: 'short' })
}

function rangeStartIso(range: RangeFilter): string | null {
  if (range === 'all') return null
  const now = new Date()
  if (range === 'today') {
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
  }
  const days = range === '7d' ? 7 : 30
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

type IpGroup = {
  ip: string
  count: number
  lastAttempt: string | null
  methods: Record<string, number>
  userAgent: string | null
}

function groupByIp(rows: SiteGateLogRow[]): IpGroup[] {
  const map = new Map<string, IpGroup>()
  for (const row of rows) {
    const ip = row.ipAddress ?? 'unknown'
    const existing = map.get(ip)
    if (existing) {
      existing.count += 1
      existing.methods[row.method] = (existing.methods[row.method] ?? 0) + 1
      if (!existing.lastAttempt || (row.attemptedAt && row.attemptedAt > existing.lastAttempt)) {
        existing.lastAttempt = row.attemptedAt
        existing.userAgent = row.userAgent
      }
    } else {
      map.set(ip, {
        ip,
        count: 1,
        lastAttempt: row.attemptedAt,
        methods: { [row.method]: 1 },
        userAgent: row.userAgent,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => (b.lastAttempt ?? '').localeCompare(a.lastAttempt ?? ''))
}

export default function SiteGateLog({
  initial,
  initialWhitelistedIps,
}: {
  initial: SiteGateLogRow[]
  initialWhitelistedIps: string[]
}) {
  const [rows, setRows] = useState(initial)
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all')
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all')
  const [loading, setLoading] = useState(false)
  const [whitelisted, setWhitelisted] = useState(new Set(initialWhitelistedIps))
  const [labelTarget, setLabelTarget] = useState<string | null>(null)
  const [labelInput, setLabelInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  function notify(type: ToastState['type'], message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  async function applyFilters(nextMethod: MethodFilter, nextRange: RangeFilter) {
    setMethodFilter(nextMethod)
    setRangeFilter(nextRange)
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (nextMethod !== 'all') params.set('method', nextMethod)
      const from = rangeStartIso(nextRange)
      if (from) params.set('from', from)

      const res = await fetch(`/api/admin/site-gate/access-log?${params.toString()}`)
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        notify('error', errorMessage(json, 'Failed to load log'))
        return
      }
      const log = isRecord(json) && Array.isArray(json.log) ? (json.log as SiteGateLogRow[]) : []
      setRows(log)
    } catch {
      notify('error', 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const groups = useMemo(() => groupByIp(rows), [rows])

  function openLabelModal(ip: string) {
    setLabelInput('')
    setLabelTarget(ip)
  }

  async function confirmWhitelist() {
    if (!labelTarget) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/site-gate/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: labelTarget, label: labelInput.trim() || null }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        notify('error', errorMessage(json, 'Failed to add to whitelist'))
        return
      }
      setWhitelisted((prev) => new Set(prev).add(labelTarget))
      notify('success', `${labelTarget} added to whitelist`)
      setLabelTarget(null)
    } catch {
      notify('error', 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginTop: tokens.spacing.lg }} padding="0">
      <div style={{ padding: tokens.spacing.base, borderBottom: `1px solid ${tokens.colors.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text }}>Access log</div>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 }}>
          Grouped by IP · {groups.length} unique {groups.length === 1 ? 'address' : 'addresses'}
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm, flexWrap: 'wrap', marginTop: tokens.spacing.md }}>
          {(['all', 'denied', 'whitelist', 'password'] as const).map((m) => (
            <Button
              key={m}
              variant={methodFilter === m ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => applyFilters(m, rangeFilter)}
            >
              {m === 'all' ? 'All methods' : m}
            </Button>
          ))}
          <span style={{ width: 1, backgroundColor: tokens.colors.border, margin: '4px 4px' }} />
          {(['today', '7d', '30d', 'all'] as const).map((r) => (
            <Button
              key={r}
              variant={rangeFilter === r ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => applyFilters(methodFilter, r)}
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 days' : r === '30d' ? '30 days' : 'All time'}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>Loading…</div>
      )}

      {!loading &&
        groups.map((group, i) => {
          const isWhitelisted = whitelisted.has(group.ip)
          return (
            <div
              key={group.ip}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: tokens.spacing.md,
                padding: tokens.spacing.base,
                borderBottom: i === groups.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' }}>
                  <span style={{ color: tokens.colors.text, fontSize: 14, fontFamily: 'monospace' }}>{group.ip}</span>
                  {group.count > 1 && (
                    <span
                      style={{
                        fontSize: 12,
                        color: tokens.colors.textMuted,
                        border: `1px solid ${tokens.colors.border}`,
                        borderRadius: tokens.radius.pill,
                        padding: '2px 8px',
                      }}
                    >
                      ×{group.count}
                    </span>
                  )}
                  {isWhitelisted && (
                    <span style={{ fontSize: 12, color: tokens.colors.brand, fontWeight: 600 }}>Whitelisted</span>
                  )}
                </div>
                <div style={{ color: tokens.colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Last seen {formatTime(group.lastAttempt)}
                </div>
                <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
                  {Object.entries(group.methods).map(([method, count]) => (
                    <span
                      key={method}
                      style={{ color: methodColor(method), fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}
                    >
                      {method} ({count})
                    </span>
                  ))}
                </div>
              </div>
              {group.ip !== 'unknown' && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isWhitelisted}
                  onClick={() => openLabelModal(group.ip)}
                >
                  {isWhitelisted ? 'Whitelisted' : 'Add to whitelist'}
                </Button>
              )}
            </div>
          )
        })}
      {!loading && groups.length === 0 && (
        <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>
          No attempts match this filter.
        </div>
      )}

      <Sheet open={labelTarget !== null} onClose={() => setLabelTarget(null)}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.sm }}>
          Add {labelTarget} to whitelist
        </div>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginBottom: tokens.spacing.md }}>
          This IP will bypass the coming-soon gate immediately.
        </div>
        <Input
          label="Label (optional)"
          placeholder="e.g. Office"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
        />
        <div style={{ display: 'flex', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg, justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="md" onClick={() => setLabelTarget(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={saving} onClick={confirmWhitelist}>
            Add
          </Button>
        </div>
      </Sheet>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: tokens.colors.surfaceElevated,
              border: `1px solid ${toast.type === 'error' ? tokens.colors.danger : tokens.colors.borderStrong}`,
              borderRadius: tokens.radius.button,
              padding: '12px 20px',
              fontSize: 14,
              color: tokens.colors.text,
              zIndex: 1000,
            }}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
