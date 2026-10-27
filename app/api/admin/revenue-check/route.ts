import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { runRevenueCheck } from '@/lib/admin/revenueCheck'
import { explainCheck } from '@/lib/admin/revenueCheckAi'
import type { Json } from '@/lib/supabase/database.types'

// 收入核對 — read-only. Runs only when an admin presses 開始核對, capped per day,
// and every run is recorded in admin_ai_runs and audit_log.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAILY_LIMIT = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const POST = withAdminSecurity(
  async (req, admin) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
    }
    const from = isRecord(body) && typeof body.from === 'string' ? body.from : ''
    const to = isRecord(body) && typeof body.to === 'string' ? body.to : ''
    const email = admin.email ?? 'unknown'

    const service = getLegacyServiceSupabase()
    const dayStartHk = new Date(`${new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)}T00:00:00+08:00`).toISOString()
    const { count, error: countError } = await service
      .from('admin_ai_runs')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'manual')
      .eq('requested_by', email)
      .gte('created_at', dayStartHk)
    if (countError) return NextResponse.json({ error: '暫時無法核對，請稍後再試' }, { status: 500 })
    if ((count ?? 0) >= DAILY_LIMIT) {
      return NextResponse.json({ error: `今日核對次數已達上限（${DAILY_LIMIT} 次），明日再試` }, { status: 429 })
    }

    const result = await runRevenueCheck({ from, to })
    if (result.error && !result.totals) {
      return NextResponse.json({ error: result.error, steps: result.steps }, { status: 400 })
    }
    const explanation = await explainCheck(result)

    const { data: run, error: runError } = await service
      .from('admin_ai_runs')
      .insert({
        kind: 'manual',
        requested_by: email,
        range_from: from,
        range_to: to,
        steps: result.steps,
        findings: result.findings,
        totals: result.totals,
        finding_count: result.findings.length,
        summary: explanation.summary,
        model: explanation.model,
        ai_error: explanation.aiError,
      })
      .select('id')
      .single()
    const runId = run && typeof run === 'object' && 'id' in run ? String((run as { id: unknown }).id) : null

    let auditError: string | null = null
    try {
      await writeAdminAudit({
        adminUserId: admin.id,
        adminEmail: email,
        action: 'revenue_check_run',
        targetTable: 'admin_ai_runs',
        targetId: runId,
        beforeValue: null,
        afterValue: { from, to, findings: result.findings.length, model: explanation.model } as Json,
      })
    } catch (err) {
      auditError = err instanceof Error ? err.message : '審計記錄寫入失敗'
    }

    return NextResponse.json({
      runId,
      result,
      summary: explanation.summary,
      model: explanation.model,
      aiError: explanation.aiError,
      saveError: runError ? '核對結果未能儲存到記錄' : null,
      auditError,
    })
  },
  { rateLimit: { bucket: 'admin_revenue_check', max: 5, windowSeconds: 60, identifierType: 'user' } },
)
