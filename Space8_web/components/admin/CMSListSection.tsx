'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { tokens } from '@/app/styles/tokens'
import type { CMSListItem } from '@/lib/data/getCMSList'

// Admin-side add/edit/delete/reorder UI for cms_list_items collections
// (FAQ items, legal terms/privacy sections) — previously only reachable via
// the public site's inline edit-mode (Phase B). Calls the same
// /api/admin/cms-list endpoints CMSList.tsx (public) already uses; no new
// backend primitives. Field inputs are a fixed two-column shape (matching
// every known collection's actual fields: {question,answer} for FAQ,
// {title,body} for legal sections) rather than a fully dynamic schema.

type Fields = Record<string, string>

export default function CMSListSection({
  title,
  page,
  collectionKey,
  locale,
  fieldNames,
  initialItems,
}: {
  title: string
  page: string
  collectionKey: string
  locale: string
  fieldNames: [string, string]
  initialItems: CMSListItem<Fields>[]
}) {
  const [items, setItems] = useState(initialItems)
  const [addOpen, setAddOpen] = useState(false)
  const [newFields, setNewFields] = useState<Fields>({ [fieldNames[0]]: '', [fieldNames[1]]: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams({ page, collection_key: collectionKey, locale })
    fetch(`/api/admin/cms-list?${params.toString()}`)
      .then((res) => res.json())
      .then((json: { items?: CMSListItem<Fields>[] }) => {
        if (json.items) setItems(json.items)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  async function addItem() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cms-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, collection_key: collectionKey, locale, fields: newFields }),
      })
      const json: unknown = await res.json().catch(() => null)
      const id = json && typeof json === 'object' && 'id' in json ? String((json as { id: unknown }).id) : null
      if (res.ok && id) {
        setItems((prev) => [...prev, { id, orderIndex: prev.length, fields: newFields }])
        setNewFields({ [fieldNames[0]]: '', [fieldNames[1]]: '' })
        setAddOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/admin/cms-list?id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    const reindexed = next.map((item, i) => ({ ...item, orderIndex: i }))
    setItems(reindexed)
    await Promise.all(
      reindexed.map((item) =>
        fetch('/api/admin/cms-list', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, order_index: item.orderIndex }),
        })
      )
    ).catch(() => {})
  }

  async function saveField(id: string, fields: Fields) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fields } : i)))
    await fetch('/api/admin/cms-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, fields }),
    }).catch(() => {})
  }

  return (
    <Card padding="0" style={{ marginBottom: tokens.spacing.lg }}>
      <div
        style={{
          padding: tokens.spacing.base,
          fontSize: 16,
          fontWeight: 700,
          color: tokens.colors.text,
          borderBottom: `1px solid ${tokens.colors.border}`,
        }}
      >
        {title}
      </div>
      {items.map((item, i) => (
        <div key={item.id} style={{ padding: tokens.spacing.base, borderBottom: `1px solid ${tokens.colors.border}` }}>
          {fieldNames.map((fn) => (
            <div key={fn} style={{ marginBottom: tokens.spacing.sm }}>
              <Input
                label={fn}
                value={item.fields[fn] ?? ''}
                onChange={(e) => saveField(item.id, { ...item.fields, [fn]: e.target.value })}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
            <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
              Move up
            </Button>
            <Button variant="ghost" size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
              Move down
            </Button>
            <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)} style={{ color: tokens.colors.danger }}>
              Delete
            </Button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ padding: tokens.spacing.lg, color: tokens.colors.textMuted, fontSize: 14 }}>No items yet.</div>
      )}
      <div style={{ padding: tokens.spacing.base }}>
        {addOpen ? (
          <div>
            {fieldNames.map((fn) => (
              <div key={fn} style={{ marginBottom: tokens.spacing.sm }}>
                <Input
                  label={fn}
                  value={newFields[fn] ?? ''}
                  onChange={(e) => setNewFields({ ...newFields, [fn]: e.target.value })}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              <Button variant="primary" size="sm" loading={saving} onClick={addItem}>
                Add
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            + Add
          </Button>
        )}
      </div>
    </Card>
  )
}
