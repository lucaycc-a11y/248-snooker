'use client'

/**
 * WidgetCard — shared glassmorphic card wrapper for all dashboard widgets.
 *
 * §3 spec: rounded-2xl glass cards with title bar, optional status dot,
 * and configurable size that maps to grid column span.
 */

import { type ReactNode } from 'react'
import type { WidgetSize } from '@/lib/admin/widgetRegistry'

const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-1 sm:col-span-2',
  lg: 'col-span-1 sm:col-span-2 lg:col-span-3',
  xl: 'col-span-1 sm:col-span-2 lg:col-span-4',
}

type WidgetCardProps = {
  title: string
  cmsKey?: string
  size: WidgetSize
  status?: 'live' | 'stale' | 'error'
  action?: ReactNode
  children: ReactNode
}

export default function WidgetCard({
  title,
  cmsKey,
  size,
  status,
  action,
  children,
}: WidgetCardProps) {
  return (
    <div
      className={`
        ${SIZE_CLASSES[size]}
        rounded-2xl overflow-hidden
        bg-[var(--admin-glass-bg)] backdrop-blur-[var(--admin-glass-blur)]
        border border-[var(--admin-border)]
        transition-colors duration-200
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {status && (
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full shrink-0 ${
                status === 'live'
                  ? 'bg-[var(--admin-brand)]'
                  : status === 'stale'
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
              }`}
            />
          )}
          <h3
            data-cms-key={cmsKey}
            className="text-sm font-semibold text-[var(--admin-text)]"
          >
            {title}
          </h3>
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Body */}
      <div className="px-5 pb-5 pt-1">{children}</div>
    </div>
  )
}
