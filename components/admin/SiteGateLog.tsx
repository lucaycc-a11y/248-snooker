'use client'

import { Card } from '@/components/ui/Card'
import { tokens } from '@/app/styles/tokens'
import type { SiteGateLogRow } from '@/lib/data/getAdminSiteGate'

function methodColor(method: string): string {
  if (method === 'whitelist') return tokens.colors.brand
  if (method === 'password') return tokens.colors.link
  return tokens.colors.danger
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-HK', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SiteGateLog({ initial }: { initial: SiteGateLogRow[] }) {
  return (
    <Card style={{ marginTop: tokens.spacing.lg }} padding="0">
      <div style={{ padding: tokens.spacing.base, borderBottom: `1px solid ${tokens.colors.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text }}>Access log</div>
        <div style={{ fontSize: 13, color: tokens.colors.textMuted, marginTop: 4 }}>
          Most recent {initial.length} attempts.
        </div>
      </div>
      {initial.map((row, i) => (
        <div
          key={row.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: tokens.spacing.md,
            padding: tokens.spacing.base,
            borderBottom: i === initial.length - 1 ? 'none' : `1px solid ${tokens.colors.border}`,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ color: tokens.colors.text, fontSize: 14, fontFamily: 'monospace' }}>
              {row.ipAddress ?? 'unknown'}
            </div>
            <div style={{ color: tokens.colors.textMuted, fontSize: 12 }}>{formatTime(row.attemptedAt)}</div>
          </div>
          <span style={{ color: methodColor(row.method), fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
            {row.method}
          </span>
        </div>
      ))}
      {initial.length === 0 && (
        <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>No attempts logged yet.</div>
      )}
    </Card>
  )
}
