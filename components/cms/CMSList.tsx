'use client'

import { useState } from 'react'
import { useEditMode } from './EditModeContext'
import { HoverToolbar } from './HoverToolbar'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { tokens } from '@/app/styles/tokens'

// Addable/removable/reorderable content list — FAQ items, legal document
// sections. Separate from CMSText's fixed key-value model: these are
// open-ended lists an admin can add/delete/reorder, which a single key can't
// express. Agnostic to the shape of `fields` (T) — caller supplies renderItem
// so the same component serves {question, answer} FAQ pairs and {title,
// body} legal sections.

export type CMSListItem<T> = { id: string; orderIndex: number; fields: T }

export function CMSList<T extends Record<string, string>>({
  page,
  collectionKey,
  locale,
  initialItems,
  emptyFields,
  renderItem,
  renderForm,
}: {
  page: string
  collectionKey: string
  locale: string
  initialItems: CMSListItem<T>[]
  emptyFields: T
  renderItem: (fields: T, id: string, index: number) => React.ReactNode
  renderForm: (fields: T, onChange: (fields: T) => void) => React.ReactNode
}) {
  const editModeCtx = useEditMode()
  const editMode = !!editModeCtx?.editMode

  const [items, setItems] = useState(initialItems)
  const [addOpen, setAddOpen] = useState(false)
  const [newFields, setNewFields] = useState<T>(emptyFields)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

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
        setNewFields(emptyFields)
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

  async function duplicateItem(id: string, index: number) {
    const res = await fetch('/api/admin/cms-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicate_id: id }),
    }).catch(() => null)
    const json: unknown = await res?.json().catch(() => null)
    const newId = json && typeof json === 'object' && 'id' in json ? String((json as { id: unknown }).id) : null
    if (res?.ok && newId) {
      setItems((prev) => {
        const next = [...prev]
        next.splice(index + 1, 0, { id: newId, orderIndex: index + 1, fields: prev[index].fields })
        return next.map((item, i) => ({ ...item, orderIndex: i }))
      })
    }
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      const reindexed = next.map((item, i) => ({ ...item, orderIndex: i }))
      Promise.all(
        reindexed.map((item) =>
          fetch('/api/admin/cms-list', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, order_index: item.orderIndex }),
          })
        )
      ).catch(() => {})
      return reindexed
    })
    setDragIndex(null)
  }

  return (
    <div>
      {items.map((item, i) => (
        <div
          key={item.id}
          draggable={editMode}
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => editMode && e.preventDefault()}
          onDrop={() => onDrop(i)}
          style={{ position: 'relative' }}
        >
          {editMode ? (
            <HoverToolbar
              kind="listItem"
              cmsKey={`${page}.${collectionKey}.${i}`}
              locale={locale}
              currentValue={JSON.stringify(item.fields)}
              onEdit={() => {
                /* Field-level inline edit is opted into per-caller via
                   renderItem's contentEditable wiring (FAQ.tsx/LegalContent.tsx) —
                   this button is a no-op signal that edit affordances exist;
                   the actual click-to-edit happens on the fields themselves. */
              }}
              onCopy={() => duplicateItem(item.id, i)}
              onDelete={() => deleteItem(item.id)}
            >
              {renderItem(item.fields, item.id, i)}
            </HoverToolbar>
          ) : (
            renderItem(item.fields, item.id, i)
          )}
        </div>
      ))}

      {editMode && (
        <div style={{ marginTop: tokens.spacing.md }}>
          <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
            + Add
          </Button>
          <Sheet open={addOpen} onClose={() => setAddOpen(false)}>
            <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.text, marginBottom: tokens.spacing.md }}>
              New item
            </div>
            {renderForm(newFields, setNewFields)}
            <div style={{ display: 'flex', gap: tokens.spacing.sm, justifyContent: 'flex-end', marginTop: tokens.spacing.md }}>
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={addItem} loading={saving}>
                Add
              </Button>
            </div>
          </Sheet>
        </div>
      )}
    </div>
  )
}
