'use client'

/**
 * DashboardGrid — §3 client wrapper with dnd-kit drag-and-drop.
 *
 * Handles widget layout state, drag reordering, and optimistic saves to
 * the dashboard-config API. Renders each widget via the registry's lazy
 * components inside a Suspense boundary.
 */

import { Suspense, useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { getWidgetById, type WidgetSize } from '@/lib/admin/widgetRegistry'
import { DEFAULT_LAYOUT } from '@/lib/admin/widgetMeta'
import type { LayoutItem } from '@/lib/admin/widgetMeta'
import WidgetCard from '@/components/admin/widgets/WidgetCard'

// ── Size → grid column span mapping ─────────────────────────────────────────

const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 md:col-span-1 lg:col-span-2',
  lg: 'col-span-1 md:col-span-2',
  xl: 'col-span-1 md:col-span-2',
}

// ── Skeleton fallback for Suspense ──────────────────────────────────────────

function WidgetSkeleton({ size }: { size: WidgetSize }) {
  return (
    <div className={`${SIZE_CLASSES[size]} min-h-[160px]`}>
      <WidgetCard title="" cmsKey="" size={size} status="stale">
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-[var(--admin-surface)] rounded w-1/3" />
          <div className="h-8 bg-[var(--admin-surface)] rounded w-1/2" />
          <div className="h-3 bg-[var(--admin-surface)] rounded w-2/3" />
        </div>
      </WidgetCard>
    </div>
  )
}

// ── Sortable widget wrapper ─────────────────────────────────────────────────

function SortableWidget({
  item,
  isAdmin,
}: {
  item: LayoutItem
  isAdmin: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const widget = getWidgetById(item.id)
  if (!widget) return null

  // Role gate: super_admin widgets hidden for regular admins
  if (widget.minRole === 'super_admin' && !isAdmin) return null

  const Component = widget.component

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${SIZE_CLASSES[item.size]} min-h-[160px] relative group`}
    >
      {/* Drag handle — visible on hover / focus */}
      {isAdmin && (
        <button
          type="button"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-[var(--admin-surface)] border border-[var(--admin-border)] text-[var(--admin-text-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label={`Drag to reorder ${widget.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </button>
      )}
      <Suspense fallback={<WidgetSkeleton size={item.size} />}>
        <Component id={item.id} size={item.size} />
      </Suspense>
    </div>
  )
}

// ── Main grid component ─────────────────────────────────────────────────────

type DashboardGridProps = {
  initialLayout: LayoutItem[]
  isAdmin: boolean
}

export default function DashboardGrid({
  initialLayout,
  isAdmin,
}: DashboardGridProps) {
  const [layout, setLayout] = useState<LayoutItem[]>(initialLayout)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLoaded = useRef(false)

  // Sync from server on first render
  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true
      // If server returned defaults, we'll get initialLayout — no need to fetch
      if (initialLayout.length === 0) {
        setLayout(DEFAULT_LAYOUT)
      }
    }
  }, [initialLayout])

  // Sensors — pointer + keyboard for drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // IDs for SortableContext
  const widgetIds = useMemo(() => layout.map((item) => item.id), [layout])

  // Optimistic save after drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      setLayout((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id)
        const newIndex = prev.findIndex((item) => item.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return prev

        const next = arrayMove(prev, oldIndex, newIndex)

        // Debounced save
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await fetch('/api/admin/dashboard-config', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            })
            if (!res.ok) {
              console.error('[dashboard] save failed', await res.text())
            }
          } catch (err) {
            console.error('[dashboard] save error', err)
          }
        }, 500)

        return next
      })
    },
    []
  )

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {layout.map((item) => (
            <SortableWidget
              key={item.id}
              item={item}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
