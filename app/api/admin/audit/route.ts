/**
 * Admin audit log API.
 *
 * GET: paginated, filterable rows from `audit_log` — the only real table.
 * An older draft read a phantom second table (PGRST205),
 * which is why this endpoint 500'd every time. Column mapping:
 *   action       <- action_type
 *   before_value <- before_jsonb
 *   after_value  <- after_jsonb  (risk_level lives inside it)
 *
 * Passwords and sensitive fields are always redacted in before/after JSONB.
 * Filters: admin_email, action, date_from, date_to, search.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Fields to redact in before/after JSONB */
const REDACTED_KEYS = new Set([
  'password', 'old_password', 'new_password', 'admin_password',
  'secret', 'token', 'api_key', 'otp',
])

function redactJsonb(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(k)) {
      result[k] = '[REDACTED]'
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      result[k] = redactJsonb(v as Record<string, unknown>)
    } else {
      result[k] = v
    }
  }
  return result
}

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const offset = (page - 1) * PAGE_SIZE

    const service = getLegacyServiceSupabase()

    // Build query against the real table.
    let query = service
      .from('audit_log')
      .select('id, admin_user_id, admin_email, action, target_table, target_id, before_value, after_value, created_at', { count: 'exact' })

    // Filters
    const adminEmail = url.searchParams.get('admin_email')
    if (adminEmail) {
      query = query.ilike('admin_email', `%${adminEmail}%`)
    }

    const actionType = url.searchParams.get('action_type') ?? url.searchParams.get('action')
    if (actionType) {
      query = query.eq('action', actionType)
    }

    const dateFrom = url.searchParams.get('date_from')
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }

    const dateTo = url.searchParams.get('date_to')
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Text search across admin_email, action and target_id
    const search = url.searchParams.get('search')
    if (search) {
      query = query.or(`admin_email.ilike.%${search}%,action.ilike.%${search}%,target_id.ilike.%${search}%`)
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[admin/audit] query error', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const after = redactJsonb(row.after_value as Record<string, unknown> | null)
      const riskLevel = isRecord(after) && typeof after.risk_level === 'string' ? after.risk_level : 'low'
      return {
        id: row.id,
        adminId: row.admin_user_id,
        adminEmail: row.admin_email,
        actionType: row.action,
        targetTable: row.target_table,
        targetId: row.target_id,
        before: redactJsonb(row.before_value as Record<string, unknown> | null),
        after,
        riskLevel,
        createdAt: row.created_at,
      }
    })

    return NextResponse.json({
      rows,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error('[admin/audit] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
