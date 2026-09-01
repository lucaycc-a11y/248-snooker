/**
 * GET /api/admin/bookings/[id]/audit-log
 *
 * Returns admin_action_log entries for a given booking.
 * Queries both admin_action_log and legacy audit_log tables.
 * Auth: getAdminData() guard.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

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

    const service = getServiceSupabase()
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

    // Try new table first (admin_action_log)
    try {
      const { data, error } = await service
        .from('admin_action_log')
        .select('id, admin_email, action_type, target_table, target_id, before_jsonb, after_jsonb, risk_level, created_at')
        .eq('target_table', 'bookings')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        entries.push(
          ...((data ?? []) as Row[]).map((r) => ({
            id: String(r.id ?? ''),
            adminEmail: String(r.admin_email ?? ''),
            actionType: String(r.action_type ?? ''),
            targetTable: r.target_table ? String(r.target_table) : null,
            targetId: r.target_id ? String(r.target_id) : null,
            beforeJsonb: (r.before_jsonb as Record<string, unknown>) ?? null,
            afterJsonb: (r.after_jsonb as Record<string, unknown>) ?? null,
            riskLevel: String(r.risk_level ?? 'low'),
            createdAt: String(r.created_at ?? ''),
          }))
        )
      }
    } catch { /* admin_action_log may not exist yet — fall through */ }

    // Also query legacy audit_log table (existing cancel endpoint writes here)
    try {
      const { data, error } = await service
        .from('audit_log')
        .select('id, admin_email, action, target_table, target_id, before_value, after_value, created_at')
        .eq('target_table', 'bookings')
        .eq('target_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        entries.push(
          ...((data ?? []) as Row[]).map((r) => ({
            id: String(r.id ?? ''),
            adminEmail: String(r.admin_email ?? ''),
            actionType: String(r.action ?? ''),
            targetTable: r.target_table ? String(r.target_table) : null,
            targetId: r.target_id ? String(r.target_id) : null,
            beforeJsonb: (r.before_value as Record<string, unknown>) ?? null,
            afterJsonb: (r.after_value as Record<string, unknown>) ?? null,
            riskLevel: 'low', // legacy table doesn't have risk_level
            createdAt: String(r.created_at ?? ''),
          }))
        )
      }
    } catch { /* audit_log may not exist — ignore */ }

    // Deduplicate by id (in case both tables have the same record)
    const seen = new Set<string>()
    const deduped = entries.filter((e) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    // Sort by created_at descending
    deduped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ entries: deduped })
  } catch (err) {
    console.error('[admin/bookings/audit-log] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
