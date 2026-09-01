import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { DEFAULT_LAYOUT, VALID_WIDGET_IDS } from '@/lib/admin/widgetMeta'
import type { LayoutItem, WidgetSize } from '@/lib/admin/widgetMeta'

/**
 * Dashboard layout persistence — §3.2.
 *
 * GET: Returns the admin's saved widget layout (or default if none saved).
 * PUT: Saves the admin's widget layout after drag-and-drop reordering.
 *
 * Table: admin_dashboard_config
 *   - id uuid PK
 *   - admin_id uuid NOT NULL UNIQUE
 *   - layout jsonb NOT NULL DEFAULT '[]'
 *   - updated_at timestamptz DEFAULT now()
 */

const VALID_SIZES = new Set<string>(['sm', 'md', 'lg', 'xl'])
const VALID_ID_SET = new Set<string>(VALID_WIDGET_IDS)

function isLayoutItem(value: unknown): value is LayoutItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  if (typeof obj.id !== 'string' || !VALID_ID_SET.has(obj.id as LayoutItem['id'])) return false
  if (typeof obj.size !== 'string' || !VALID_SIZES.has(obj.size)) return false
  return true
}

function isLayoutArray(value: unknown): value is LayoutItem[] {
  if (!Array.isArray(value)) return false
  return value.length > 0 && value.every(isLayoutItem)
}

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('admin_dashboard_config')
      .select('layout')
      .eq('admin_id', admin.userId)
      .maybeSingle()

    if (error) {
      // Table may not exist yet — return default layout silently
      return NextResponse.json({ layout: DEFAULT_LAYOUT })
    }

    const layout = data?.layout
    if (isLayoutArray(layout)) {
      return NextResponse.json({ layout })
    }

    return NextResponse.json({ layout: DEFAULT_LAYOUT })
  } catch (err) {
    console.error('[admin/dashboard-config] GET error', err)
    return NextResponse.json({ layout: DEFAULT_LAYOUT })
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    if (!isLayoutArray(body)) {
      return NextResponse.json({ error: 'Invalid layout' }, { status: 400 })
    }

    // Sanitize: deduplicate by id (keep last occurrence), cap at 20 items
    const seen = new Set<string>()
    const sanitized: LayoutItem[] = []
    for (let i = body.length - 1; i >= 0; i--) {
      const item = body[i]
      if (!seen.has(item.id)) {
        seen.add(item.id)
        sanitized.unshift(item)
      }
    }
    sanitized.length = Math.min(sanitized.length, 20)

    // If completely empty after sanitization, fall back to default
    const layoutToSave = sanitized.length > 0 ? sanitized : DEFAULT_LAYOUT

    const service = getServiceSupabase()

    // Read existing layout for audit
    const { data: existing } = await service
      .from('admin_dashboard_config')
      .select('layout')
      .eq('admin_id', admin.userId)
      .maybeSingle()

    // Upsert — one row per admin
    const { error: upsertError } = await service
      .from('admin_dashboard_config')
      .upsert(
        {
          admin_id: admin.userId,
          layout: layoutToSave,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'admin_id' }
      )

    if (upsertError) {
      console.error('[admin/dashboard-config] upsert failed', upsertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    // Audit — log layout change
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'dashboard_layout_update',
      target_table: 'admin_dashboard_config',
      target_id: admin.userId,
      before_value: existing?.layout ?? null,
      after_value: layoutToSave,
    })

    return NextResponse.json({ success: true, layout: layoutToSave })
  } catch (err) {
    console.error('[admin/dashboard-config] PUT error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
