'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditMode } from './EditModeContext'
import { tokens } from '@/app/styles/tokens'

// Wraps a CMSText-rendered element with click-to-edit behavior when
// edit-mode is on. Reuses the EXISTING draft route (app/api/admin/cms/route.ts,
// Phase 6, unmodified) then immediately publishes the same draft — a
// deliberate deviation from the manual editor's two-step flow, since inline
// edit-in-place is meant to feel instant. Still fully audited: both the
// draft insert and the publish write audit_log rows via the existing routes.

export function EditableText({
  cmsKey,
  locale,
  value,
  as: Tag = 'span',
  className,
  style,
}: {
  cmsKey: string
  locale: string
  value: string
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
}) {
  const editModeCtx = useEditMode()
  const ref = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const originalRef = useRef(value)

  const Component = Tag as React.ElementType

  useEffect(() => {
    if (!editing && ref.current) {
      ref.current.textContent = value
    }
  }, [value, editing])

  if (!editModeCtx?.editMode) {
    return (
      <Component data-cms-key={cmsKey} className={className} style={style}>
        {value}
      </Component>
    )
  }

  async function save(newText: string) {
    if (newText === originalRef.current) return
    try {
      const draftRes = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_key: cmsKey, locale, new_value: newText }),
      })
      const draftJson: unknown = await draftRes.json().catch(() => null)
      const versionId =
        draftJson && typeof draftJson === 'object' && 'version_id' in draftJson
          ? (draftJson as { version_id: string }).version_id
          : null
      if (!draftRes.ok || !versionId) return

      await fetch('/api/admin/cms/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_id: versionId }),
      })

      originalRef.current = newText
      setSaved(true)
      setTimeout(() => setSaved(false), 600)
    } catch {
      // Best-effort inline save — Realtime will reconcile the displayed
      // value from the DB on next update regardless.
    }
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <Component
        ref={ref}
        data-cms-key={cmsKey}
        className={className}
        style={{ ...style, outline: editing ? `2px solid ${tokens.colors.brand}` : undefined }}
        suppressContentEditableWarning
        contentEditable={editing}
        onClick={(e: React.MouseEvent) => {
          if (!editing) {
            // Prevent the click from also firing a parent Link/button's
            // navigation/action — a CMSText nested inside a nav link or CTA
            // button must not trigger that link while an admin is editing it.
            e.preventDefault()
            e.stopPropagation()
            setEditing(true)
            requestAnimationFrame(() => ref.current?.focus())
          }
        }}
        onBlur={() => {
          if (!editing) return
          setEditing(false)
          save(ref.current?.textContent ?? value)
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            ref.current?.blur()
          }
          if (e.key === 'Escape') {
            if (ref.current) ref.current.textContent = originalRef.current
            setEditing(false)
            ref.current?.blur()
          }
        }}
      />
      {saved && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            width: 14,
            height: 14,
            borderRadius: '50%',
            backgroundColor: tokens.colors.brand,
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  )
}
