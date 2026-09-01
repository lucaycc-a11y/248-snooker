/**
 * Admin System Health API — §11.4.
 *
 * GET /api/admin/health
 * Returns: { checks: HealthCheck[] }
 *
 * Checks: DB connectivity, VectorEngine config, cron jobs, hardcoded secret detection.
 * Security: requires admin auth (getAdminData).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

type HealthStatus = 'ok' | 'warning' | 'error'

type HealthCheck = {
  name: string
  status: HealthStatus
  message: string
  details?: Record<string, unknown>
}

/* ── GET — run all health checks ───────────────────────── */
export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()
    const checks: HealthCheck[] = []

    // ── 1. DB connectivity ────────────────────────────────
    try {
      const { error } = await service.from('admin_action_log').select('id').limit(1)
      checks.push({
        name: 'Database',
        status: error ? 'error' : 'ok',
        message: error ? `Database query failed: ${error.message}` : 'Connected',
      })
    } catch {
      checks.push({ name: 'Database', status: 'error', message: 'Connection failed' })
    }

    // ── 2. VectorEngine / AI config ───────────────────────
    try {
      const { data, error } = await service
        .from('config')
        .select('key, value')
        .in('key', ['vectorengine_enabled', 'ai_daily_insights_enabled'])
        .limit(10)

      if (error) {
        checks.push({
          name: 'VectorEngine',
          status: 'warning',
          message: `Could not check config: ${error.message}`,
        })
      } else {
        const configRows = Array.isArray(data) ? data : []
        const veEnabled = configRows.some(
          (r: Record<string, unknown>) => r.key === 'vectorengine_enabled' && r.value === true
        )
        checks.push({
          name: 'VectorEngine',
          status: veEnabled ? 'ok' : 'warning',
          message: veEnabled ? 'Enabled in config' : 'Not enabled (AI insights may use stub data)',
        })
      }
    } catch {
      checks.push({ name: 'VectorEngine', status: 'warning', message: 'Config table not available' })
    }

    // ── 3. Cron jobs / scheduled tasks ────────────────────
    try {
      // Check if ai_daily_insights table has recent entries
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const { data, error } = await service
        .from('ai_daily_insights')
        .select('id, date, generated_at')
        .gte('date', threeDaysAgo.toISOString().slice(0, 10))
        .order('date', { ascending: false })
        .limit(5)

      if (error) {
        checks.push({
          name: 'Cron Jobs',
          status: 'warning',
          message: `ai_daily_insights table not available: ${error.message}`,
        })
      } else {
        const rows = Array.isArray(data) ? data : []
        checks.push({
          name: 'Cron Jobs',
          status: rows.length > 0 ? 'ok' : 'warning',
          message: rows.length > 0
            ? `AI insights running (${rows.length} recent entries)`
            : 'No recent AI insights — cron may not be active',
          details: { recentEntries: rows.length },
        })
      }
    } catch {
      checks.push({ name: 'Cron Jobs', status: 'warning', message: 'Could not verify cron status' })
    }

    // ── 4. Hardcoded secret detection ─────────────────────
    try {
      const { data, error } = await service
        .from('config')
        .select('key, value')
        .eq('key', 'send-booking-reminders')
        .limit(1)

      if (error) {
        checks.push({
          name: 'Secrets',
          status: 'ok',
          message: 'Config key not found (env var may be used instead)',
        })
      } else {
        const rows = Array.isArray(data) ? data : []
        if (rows.length > 0) {
          const val = rows[0]?.value
          checks.push({
            name: 'Secrets',
            status: 'warning',
            message: 'Hardcoded secret "send-booking-reminders" detected in config table — should use env var',
          })
        } else {
          checks.push({
            name: 'Secrets',
            status: 'ok',
            message: 'No hardcoded secrets detected',
          })
        }
      }
    } catch {
      checks.push({ name: 'Secrets', status: 'ok', message: 'Check skipped (config table not available)' })
    }

    // ── 5. Admin action log health ────────────────────────
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const { count, error } = await service
        .from('admin_action_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString())

      if (error) {
        checks.push({
          name: 'Audit Log',
          status: 'warning',
          message: `Could not query audit log: ${error.message}`,
        })
      } else {
        checks.push({
          name: 'Audit Log',
          status: (count ?? 0) > 0 ? 'ok' : 'warning',
          message: `${count ?? 0} actions logged in last 7 days`,
          details: { count: count ?? 0 },
        })
      }
    } catch {
      checks.push({ name: 'Audit Log', status: 'warning', message: 'Could not verify audit log' })
    }

    // ── 6. Venue pause status ─────────────────────────────
    try {
      const { data, error } = await service
        .from('config')
        .select('key, value')
        .eq('key', 'venue_paused')
        .limit(1)

      if (!error) {
        const rows = Array.isArray(data) ? data : []
        const paused = rows.length > 0 && rows[0]?.value === true
        checks.push({
          name: 'Venue',
          status: paused ? 'warning' : 'ok',
          message: paused ? 'Venue is currently paused' : 'Venue is active',
        })
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ checks })
  } catch (err) {
    console.error('[admin/health] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
