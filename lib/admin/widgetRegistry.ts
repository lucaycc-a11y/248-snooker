'use client'

/**
 * Widget registry — §3.1 spec.
 *
 * Central registry for all admin dashboard widgets. Each widget declares its
 * sizes, minimum role, and lazy-loaded component. Dashboard reads this to
 * render the grid via dnd-kit.
 */

import { lazy, type ComponentType } from 'react'

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl'

export type WidgetProps = {
  id: string
  size: WidgetSize
  className?: string
}

export type WidgetEntry = {
  id: string
  name: string
  cmsKey: string
  sizes: WidgetSize[]
  minRole: 'admin' | 'super_admin'
  component: ComponentType<WidgetProps>
}

/**
 * All 7 required widgets (§3.1–3.7), lazy-loaded.
 */
export const WIDGET_REGISTRY: WidgetEntry[] = [
  {
    id: 'revenue_today',
    name: "Today's Revenue",
    cmsKey: 'widget_revenue_today',
    sizes: ['sm', 'md'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/RevenueWidget')),
  },
  {
    id: 'revenue_month',
    name: 'Monthly Revenue',
    cmsKey: 'widget_revenue_month',
    sizes: ['md', 'lg'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/RevenueWidget')),
  },
  {
    id: 'booking_donut',
    name: 'Bookings Overview',
    cmsKey: 'widget_booking_donut',
    sizes: ['md', 'lg'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/BookingDonut')),
  },
  {
    id: 'ai_insights',
    name: 'AI Insights',
    cmsKey: 'widget_ai_insights',
    sizes: ['lg', 'xl'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/AIInsightsWidget')),
  },
  {
    id: 'anomaly_alert',
    name: 'Anomaly Alerts',
    cmsKey: 'widget_anomaly_alert',
    sizes: ['sm', 'md'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/AnomalyWidget')),
  },
  {
    id: 'pending_items',
    name: 'Pending Actions',
    cmsKey: 'widget_pending_items',
    sizes: ['md', 'lg'],
    minRole: 'super_admin',
    component: lazy(() => import('@/components/admin/widgets/PendingWidget')),
  },
  {
    id: 'live_active_users',
    name: 'Active Users',
    cmsKey: 'widget_active_users',
    sizes: ['sm', 'md'],
    minRole: 'admin',
    component: lazy(() => import('@/components/admin/widgets/ActiveUsersWidget')),
  },
]

export const DEFAULT_LAYOUT: { id: string; size: WidgetSize }[] = [
  { id: 'revenue_today', size: 'sm' },
  { id: 'revenue_month', size: 'md' },
  { id: 'booking_donut', size: 'md' },
  { id: 'ai_insights', size: 'lg' },
  { id: 'anomaly_alert', size: 'sm' },
  { id: 'pending_items', size: 'md' },
  { id: 'live_active_users', size: 'md' },
]

export function getWidgetById(id: string): WidgetEntry | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id)
}
