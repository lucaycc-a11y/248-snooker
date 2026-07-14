'use client'

import { useRef, useState } from 'react'
import { Sparkles, Pencil, Copy, Trash2 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'
import { HoverAskForChanges } from './HoverAskForChanges'

// Shopify-style hover contextual toolbar — appears above a CMS element after
// a 300ms hover-hold, offering Ask-for-changes (AI)/Copy/Edit/Delete. Only
// ever rendered when edit-mode is on (callers gate this). Wraps its child in
// a position:relative boundary and tracks hover across BOTH the child and
// the toolbar itself (one shared boolean) so moving the pointer from the
// text into the toolbar doesn't dismiss it.

export type HoverToolbarKind = 'scalar' | 'listItem'

export function HoverToolbar({
  kind,
  cmsKey,
  locale,
  currentValue,
  onEdit,
  onDelete,
  onCopy,
  children,
}: {
  kind: HoverToolbarKind
  cmsKey: string
  locale: string
  currentValue: string
  onEdit: () => void
  onDelete?: () => void
  onCopy?: () => void
  children: React.ReactNode
}) {
  const [hovering, setHovering] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function armHover() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setHovering(true), 300)
  }

  function disarmHover() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setHovering(false)
  }

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: tokens.colors.text,
    cursor: 'pointer',
  }

  const disabledStyle: React.CSSProperties = {
    ...buttonStyle,
    color: tokens.colors.textFaint,
    cursor: 'not-allowed',
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={armHover}
      onMouseLeave={disarmHover}
    >
      {children}
      {hovering && !askOpen && (
        <div
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={disarmHover}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            display: 'flex',
            gap: 2,
            padding: 4,
            backgroundColor: tokens.colors.surfaceElevated,
            border: `1px solid ${tokens.colors.borderStrong}`,
            borderRadius: 8,
            zIndex: 60,
            whiteSpace: 'nowrap',
          }}
        >
          <button style={buttonStyle} aria-label="Ask for changes" onClick={() => setAskOpen(true)}>
            <Sparkles size={15} />
          </button>
          <button style={buttonStyle} aria-label="Edit" onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button
            style={kind === 'listItem' && onCopy ? buttonStyle : disabledStyle}
            aria-label="Copy"
            disabled={kind !== 'listItem' || !onCopy}
            title={kind === 'scalar' ? 'Not available for text — clear-to-fallback is not built yet' : undefined}
            onClick={onCopy}
          >
            <Copy size={15} />
          </button>
          <button
            style={kind === 'listItem' && onDelete ? buttonStyle : disabledStyle}
            aria-label="Delete"
            disabled={kind !== 'listItem' || !onDelete}
            title={kind === 'scalar' ? 'Not available for text — clear-to-fallback is not built yet' : undefined}
            onClick={onDelete}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
      {askOpen && (
        <HoverAskForChanges
          cmsKey={cmsKey}
          locale={locale}
          currentValue={currentValue}
          onClose={() => {
            setAskOpen(false)
            disarmHover()
          }}
        />
      )}
    </span>
  )
}
