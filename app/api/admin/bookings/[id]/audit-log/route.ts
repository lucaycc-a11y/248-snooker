/**
 * GET /api/admin/bookings/[id]/audit-log
 *
 * Returns `audit_log` entries for a given booking. It is the only
 * audit table; an older draft also queried a phantom second one.
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

type Row = Record<string, unknown>

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminData()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const service = getLegacyServiceSupabase()
    const entries: {
      id: string
      adminEmail: string
      actionType: string
      targetTable: string | null
      targetId: string | null
      beforeJsonb: Record<string, unknown> | null
      afterJsonb: Record<string, unknown> | null
      riskLevel: string
      createdAt: string
    }[] = []

    // The one real table. `risk_level` is folded into after_value by
    // writeAdminActionLog, so pull it back out here for the drawer UI.
    try {
      const { data, error } = await service
        .from('audit_log')
        .select('id, admin_email, action, target_table, target_id, before_value, after_value, created_at')
        .eq('target_table', 'bookings')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[admin/bookings/audit-log] query error', error)
        return NextResponse.json({ error: 'Query failed' }, { status: 500 })
      }

      if (data) {
        entries.push(
          ...((data ?? []) as Row[]).map((r) => {
            const after = (r.after_value as Record<string, unknown> | null) ?? null
            const riskLevel =
              after && typeof after.risk_level === 'string' ? after.risk_level : 'low'
            return {
              id: String(r.id ?? ''),
              adminEmail: String(r.admin_email ?? ''),
              actionType: String(r.action ?? ''),
              targetTable: r.target_table ? String(r.target_table) : null,
              targetId: r.target_id ? String(r.target_id) : null,
              beforeJsonb: (r.before_value as Record<string, unknown>) ?? null,
              afterJsonb: after,
              riskLevel,
              createdAt: String(r.created_at ?? ''),
            }
          })
        )
      }
    } catch (err) {
      console.error('[admin/bookings/audit-log] query threw', err)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const deduped = entries

    // Sort by created_at descending
    deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ entries: deduped })
  } catch (err) {
    console.error('[admin/bookings/audit-log] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
