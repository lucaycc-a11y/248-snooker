'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'
import type { CMSPageGroup, CMSRow } from '@/lib/data/getAdminCMS'
import { getVariantOptions } from '@/lib/data/getAdminCMS'

type ToastState = { type: 'success' | 'error'; message: string }

function EditRow({
  row,
  variantOptions,
  onSaved,
}: {
  row: CMSRow
  variantOptions: string[] | null
  onSaved: (message: string) => void
}) {
  const [value, setValue] = useState(row.value)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = value !== row.value

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_key: row.key, locale: row.locale, new_value: value }),
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string'
            ? (json as { error: string }).error
            : 'Save failed'
        onSaved(message)
        return
      }
      onSaved('Draft saved — publish it from CMS history')
    } catch {
      onSaved('Network error')
    } finally {
      setSaving(false)
      setConfirmOpen(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: tokens.spacing.sm,
        padding: tokens.spacing.base,
        borderBottom: `1px solid ${tokens.colors.border}`,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        {variantOptions ? (
          <>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: tokens.colors.textMuted }}>
              {row.key}
            </label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                height: 52,
                width: '100%',
                padding: '0 14px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: `1px solid ${tokens.colors.border}`,
                borderRadius: tokens.radius.input,
                color: tokens.colors.text,
                fontSize: 15,
              }}
            >
              {variantOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </>
        ) : (
          <Input label={row.key} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => setConfirmOpen(true)}>
        Save draft
      </Button>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
          Save draft: {row.key}
        </div>
        <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: tokens.spacing.xs }}>Before</div>
        <div style={{ fontSize: 14, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>{row.value}</div>
        <div style={{ fontSize: 14, color: tokens.colors.textMuted, marginBottom: tokens.spacing.xs }}>After</div>
        <div style={{ fontSize: 14, color: tokens.colors.text, marginBottom: tokens.spacing.lg }}>{value}</div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving}>
            Save as draft
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

export default function CMSEditor({ groups }: { groups: CMSPageGroup[] }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  function notify(message: string) {
    setToast({ type: message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'error' : 'success', message })
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div>
      {groups.map((group) => (
        <Card key={group.page} padding="0" style={{ marginBottom: tokens.spacing.lg }}>
          <div
            style={{
              padding: tokens.spacing.base,
              fontSize: 16,
              fontWeight: 700,
              color: tokens.colors.text,
              borderBottom: `1px solid ${tokens.colors.border}`,
              textTransform: 'capitalize',
            }}
          >
            {group.page}
          </div>
          {group.rows.map((row) => (
            <EditRow
              key={row.key}
              row={row}
              variantOptions={row.isVariant ? getVariantOptions(row.key) : null}
              onSaved={notify}
            />
          ))}
        </Card>
      ))}

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
    </div>
  )
}
