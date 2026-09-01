/**
 * Widget layout metadata — server-safe (no 'use client').
 *
 * Shared between the dashboard page (client) and the dashboard-config API
 * route (server). Kept separate from widgetRegistry.ts because that file is
 * marked 'use client' — importing plain values from a client module into a
 * server module would yield client-reference proxies, not real data.
 */

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl'

export type LayoutItem = { id: string; size: WidgetSize; position?: number }

export const VALID_WIDGET_IDS = [
  'revenue_today',
  'revenue_month',
  'booking_donut',
  'ai_insights',
  'anomaly_alert',
  'pending_items',
  'live_active_users',
] as const

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: 'revenue_today', size: 'sm' },
  { id: 'revenue_month', size: 'md' },
  { id: 'booking_donut', size: 'md' },
  { id: 'ai_insights', size: 'lg' },
  { id: 'anomaly_alert', size: 'sm' },
  { id: 'pending_items', size: 'md' },
  { id: 'live_active_users', size: 'md' },
]
