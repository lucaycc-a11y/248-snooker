'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Sheet } from '@/components/ui/Sheet'
import { tokens } from '@/app/styles/tokens'
import type { CMSPageGroup, CMSRow } from '@/lib/data/getAdminCMS'
import { getVariantOptions } from '@/lib/data/getAdminCMS'
import { statusColor } from '@/lib/cms/statusColor'
import CMSListSection from '@/components/admin/CMSListSection'
import type { CMSListItem } from '@/lib/data/getCMSList'

const LOCALES: { code: string; label: string }[] = [
  { code: 'zh-HK', label: '繁中' },
  { code: 'zh-CN', label: '简中' },
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
]

const KNOWN_LISTS: { title: string; page: string; collectionKey: string; fieldNames: [string, string] }[] = [
  { title: 'FAQ items', page: 'faq', collectionKey: 'faq_items', fieldNames: ['question', 'answer'] },
  { title: 'Legal — Terms sections', page: 'legal', collectionKey: 'terms_sections', fieldNames: ['title', 'body'] },
  { title: 'Legal — Privacy sections', page: 'legal', collectionKey: 'privacy_sections', fieldNames: ['title', 'body'] },
]

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 13, color: tokens.colors.textMuted }}>{row.key}</label>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: statusColor(row.status),
              border: `1px solid ${statusColor(row.status)}`,
              borderRadius: 4,
              padding: '1px 6px',
            }}
          >
            {row.status}
          </span>
        </div>
        {variantOptions ? (
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
        ) : (
          <Input value={value} onChange={(e) => setValue(e.target.value)} />
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

function PageSection({ group, onSaved }: { group: CMSPageGroup; onSaved: (message: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Card padding="0" style={{ marginBottom: tokens.spacing.lg }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: tokens.spacing.base,
          background: 'none',
          border: 'none',
          borderBottom: open ? `1px solid ${tokens.colors.border}` : 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, textTransform: 'capitalize' }}>
          {group.page} <span style={{ color: tokens.colors.textMuted, fontWeight: 400, fontSize: 13 }}>({group.rows.length})</span>
        </span>
        <ChevronDown
          size={18}
          color={tokens.colors.textMuted}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}
        />
      </button>
      {open &&
        group.rows.map((row) => (
          <EditRow key={row.key} row={row} variantOptions={row.isVariant ? getVariantOptions(row.key) : null} onSaved={onSaved} />
        ))}
    </Card>
  )
}

export default function CMSEditor({
  groups: initialGroups,
  locale: initialLocale,
  lists,
}: {
  groups: CMSPageGroup[]
  locale: string
  lists: { title: string; page: string; collectionKey: string; fieldNames: [string, string]; items: CMSListItem<Record<string, string>>[] }[]
}) {
  const [locale, setLocale] = useState(initialLocale)
  const [groups, setGroups] = useState(initialGroups)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'content' | 'lists'>('content')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  function notify(message: string) {
    setToast({ type: message.toLowerCase().includes('fail') || message.toLowerCase().includes('error') ? 'error' : 'success', message })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchGroups = useCallback((loc: string, q: string) => {
    setLoading(true)
    const params = new URLSearchParams({ locale: loc })
    if (q) params.set('search', q)
    fetch(`/api/admin/cms?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { groups: CMSPageGroup[] }) => setGroups(json.groups))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchGroups(locale, search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: tokens.spacing.lg, borderBottom: `1px solid ${tokens.colors.border}` }}>
        {(['content', 'lists'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? `2px solid ${tokens.colors.brand}` : '2px solid transparent',
              color: tab === t ? tokens.colors.text : tokens.colors.textMuted,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t === 'content' ? 'Content' : 'Lists'}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <>
          <div style={{ display: 'flex', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLocale(l.code)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: tokens.radius.button,
                    border: `1px solid ${locale === l.code ? tokens.colors.brand : tokens.colors.border}`,
                    background: locale === l.code ? tokens.colors.brandDim : 'transparent',
                    color: locale === l.code ? tokens.colors.text : tokens.colors.textMuted,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div style={{ minWidth: 200, marginLeft: 'auto' }}>
              <Input
                placeholder="Search key or value"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchGroups(locale, search)
                }}
              />
            </div>
            <Button variant="secondary" size="md" onClick={() => fetchGroups(locale, search)} loading={loading}>
              Search
            </Button>
          </div>

          {groups.map((group) => (
            <PageSection key={group.page} group={group} onSaved={notify} />
          ))}
          {groups.length === 0 && !loading && (
            <div style={{ color: tokens.colors.textMuted, fontSize: 14, padding: tokens.spacing.lg }}>No matching content.</div>
          )}
        </>
      ) : (
        <div>
          {lists.map((list) => (
            <CMSListSection
              key={`${list.page}:${list.collectionKey}`}
              title={list.title}
              page={list.page}
              collectionKey={list.collectionKey}
              locale={locale}
              fieldNames={list.fieldNames}
              initialItems={list.items}
            />
          ))}
        </div>
      )}

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
