import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

type WidgetSize = '1x1' | '2x1' | '1x2' | '2x2'

type Widget = {
  id: string
  size: WidgetSize
}

type WidgetGridProps<T extends Widget> = {
  widgets: T[]
  onDragStart?: (id: string) => void
  onDrop?: (id: string) => void
  draggedId?: string | null
  onKeyboardMove?: (id: string, direction: 'previous' | 'next') => void
  renderWidget: (widget: T) => ReactNode
}

export default function WidgetGrid<T extends Widget>({
  widgets,
  onDragStart,
  onDrop,
  draggedId,
  onKeyboardMove,
  renderWidget,
}: WidgetGridProps<T>) {
  const [announcement, setAnnouncement] = useState('')

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, widget: T) => {
    if (!onKeyboardMove) return
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      ? 'previous'
      : event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 'next'
        : null
    if (!direction) return
    event.preventDefault()
    onKeyboardMove(widget.id, direction)
    setAnnouncement(`${widget.id} moved ${direction}`)
  }

  return (
    <>
      <div className="admin-ui-widget-grid" role="list" aria-label="Dashboard widgets">
        {widgets.map((widget) => (
          <div
            key={widget.id}
            role="listitem"
            tabIndex={0}
            draggable
            aria-label={`Widget ${widget.id}. Use arrow keys to move.`}
            onDragStart={() => onDragStart?.(widget.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => onDrop?.(widget.id)}
            onKeyDown={(event) => handleKeyDown(event, widget)}
            className={`admin-ui-widget-grid-item admin-ui-widget-grid-item--${widget.size} ${draggedId === widget.id ? 'admin-ui-widget-grid-item--dragging' : ''}`}
          >
            {renderWidget(widget)}
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </>
  )
}
