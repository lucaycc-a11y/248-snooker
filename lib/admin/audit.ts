import { getServiceSupabase } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/database.types'

/**
 * Admin action audit — the one table, `audit_log`.
 *
 * This is NOT `lib/security/audit-log.ts`. That one writes login/OTP/CSRF
 * events to `security_audit_log` and is fire-and-forget by design. This one
 * records who changed what inside /admin, and it must not be quiet: if the
 * insert fails the caller's transaction should fail with it. Swallowing here
 * is how the old writes went missing without anyone noticing the table
 * did not exist.
 *
 * Column mapping when porting older call sites:
 *   action_type   -> action
 *   before_jsonb  -> before_value
 *   after_jsonb   -> after_value
 *   risk_level, confirmed_by -> folded into after_value (no columns of their own)
 *
 * Nullability follows `audit_log` exactly: `admin_email` and `target_table`
 * are NOT NULL in the table, so they are required here too. Passing `null`
 * for either is a programming error, not a valid insert.
 */

export type AdminAuditRow = {
  adminUserId: string | null
  /** NOT NULL in `audit_log` — always the acting admin's email. */
  adminEmail: string
  /** Short past-tense slug, e.g. `booking_cancel_with_credit`. */
  action: string
  /** NOT NULL in `audit_log` — use a literal like `admin_action` if unscoped. */
  targetTable: string
  targetId: string | null
  beforeValue: Json | null
  afterValue: Json | null
  ipAddress?: string | null
}

/**
 * Write one admin action to `audit_log`.
 *
 * Throws on failure. Callers that move money, points, status or access should
 * call this in the same request as the change so a lost audit row is not a
 * silent success. SQL functions that already write `audit_log` inside their
 * transaction (`admin_cancel_with_credit`, `admin_adjust_*`) do not need this.
 */
export async function writeAdminAudit(row: AdminAuditRow): Promise<void> {
  const supabase = getServiceSupabase()
  const { error } = await supabase.from('audit_log').insert({
    admin_user_id: row.adminUserId,
    admin_email: row.adminEmail,
    action: row.action,
    target_table: row.targetTable,
    target_id: row.targetId,
    before_value: row.beforeValue,
    after_value: row.afterValue,
    ip_address: row.ipAddress ?? null,
  })

  if (error) {
    // Loud on purpose. An audit write that fails is a failed change.
    throw new Error(`admin audit write failed (${row.action}): ${error.message}`)
  }
}

/**
 * Legacy-shaped writer for call sites that still speak the old
 * snake_case field names. Maps onto `audit_log` and folds `riskLevel` / `confirmedBy`
 * into `after_value`, which has no columns of its own.
 *
 * Exists so the migration is one function swap per call site rather than a
 * rewrite of every payload. Delete this once no caller passes `actionType`.
 */
export type LegacyAdminActionRow = {
  adminUserId?: string | null
  adminEmail?: string | null
  /** legacy name for `action` */
  actionType: string
  targetTable?: string | null
  targetId?: string | null
  /** legacy name for `before_value`; accepts a JSON string from old call sites */
  beforeJsonb?: Record<string, unknown> | string | null
  /** legacy name for `after_value` */
  afterJsonb?: Record<string, unknown> | string | null
  riskLevel?: string | null
  confirmedBy?: string | null
  ipAddress?: string | null
}

function coerceJson(value: Record<string, unknown> | string | null | undefined): Json | null {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return (parsed ?? null) as Json | null
    } catch {
      return value
    }
  }
  return value as Json
}

export async function writeAdminActionLog(row: LegacyAdminActionRow): Promise<void> {
  const after = coerceJson(row.afterJsonb)
  const afterWithMeta: Json | null =
    row.riskLevel != null || row.confirmedBy != null
      ? {
          ...(typeof after === 'object' && after !== null && !Array.isArray(after)
            ? (after as Record<string, Json | undefined>)
            : { value: after }),
          ...(row.riskLevel != null ? { risk_level: row.riskLevel } : {}),
          ...(row.confirmedBy != null ? { confirmed_by: row.confirmedBy } : {}),
        }
      : after

  await writeAdminAudit({
    adminUserId: row.adminUserId ?? null,
    adminEmail: row.adminEmail ?? 'unknown',
    action: row.actionType,
    targetTable: row.targetTable ?? 'admin_action',
    targetId: row.targetId ?? null,
    beforeValue: coerceJson(row.beforeJsonb),
    afterValue: afterWithMeta,
    ipAddress: row.ipAddress ?? null,
  })
}
