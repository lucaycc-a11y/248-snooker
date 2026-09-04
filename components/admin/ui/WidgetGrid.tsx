'use client'

type Widget = {
  id: string
  title: string
  size: string
  kind: 'number' | 'line' | 'ring' | 'bars' | 'ai'
}

type WidgetGridProps = {
  widgets: Widget[]
  onDragStart?: (id: string) => void
  onDrop?: (id: string) => void
  draggedId?: string | null
  renderWidget: (widget: Widget) => React.ReactNode
}

export default function WidgetGrid({
  widgets,
  onDragStart,
  onDrop,
  draggedId,
  renderWidget,
}: WidgetGridProps) {
  return (
    <div className="sg-widget-grid">
      {widgets.map((widget) => (
        <div
          key={widget.id}
          draggable
          onDragStart={() => onDragStart?.(widget.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop?.(widget.id)}
          className={`sg-widget sg-size-${widget.size} ${
            draggedId === widget.id ? 'is-dragging' : ''
          }`}
        >
          {renderWidget(widget)}
        </div>
      ))}
    </div>
  )
}
