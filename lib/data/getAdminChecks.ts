import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import type { CheckSeverity } from '@/lib/admin/revenueCheck'

// Server-only loaders for 收入核對 (past runs, open automatic alerts) and 問題回報 (reports).

export type PastRun = {
  id: string
  createdAt: string
  kind: 'manual' | 'auto'
  requestedBy: string | null
  from: string
  to: string
  findingCount: number
  summary: string | null
  model: string | null
}

export type OpenAlert = {
  key: string
  severity: CheckSeverity
  title: string
  detail: string
  critical: boolean
  firstSeenAt: string
  lastEmailedAt: string | null
  /** Filled in by the automatic patrol when it investigated this alert. */
  aiAnswer: string | null
  aiModel: string | null
  /** Why the triage decided an investigation was not needed. */
  aiReason: string | null
}

export type BugReportRow = {
  id: string
  createdAt: string
  reporter: string
  severity: 'urgent' | 'annoying' | 'idea'
  title: string
  description: string
  pageUrl: string | null
  viewport: string | null
  userAgent: string | null
  hasScreenshot: boolean
  status: 'open' | 'in_progress' | 'resolved'
  emailSentAt: string | null
  emailError: string | null
  recentErrors: { at: string | null; source: string | null; message: string }[]
}

function isSeverity(v: string | null): v is CheckSeverity {
  return v === 'high' || v === 'medium' || v === 'low'
}

export async function getChecksOverview(): Promise<{ runs: PastRun[]; alerts: OpenAlert[]; error: string | null }> {
  const service = getLegacyServiceSupabase()
  const failures: string[] = []
  let runs: PastRun[] = []
  let alerts: OpenAlert[] = []

  const [runRes, alertRes] = await Promise.all([
    service
      .from('admin_ai_runs')
      .select('id, created_at, kind, requested_by, range_from, range_to, finding_count, summary, model')
      .order('created_at', { ascending: false })
      .limit(8),
    service
      .from('admin_alerts')
      .select('alert_key, severity, title, detail, first_seen_at, last_emailed_at')
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(30),
  ])
  if (runRes.error) failures.push('過往核對載入失敗')
  else {
    runs = ((runRes.data ?? []) as unknown as Row[]).map((r) => ({
      id: String(r.id),
      createdAt: str(r, ['created_at']) ?? '',
      kind: r.kind === 'auto' ? 'auto' : 'manual',
      requestedBy: str(r, ['requested_by']),
      from: str(r, ['range_from']) ?? '',
      to: str(r, ['range_to']) ?? '',
      findingCount: num(r, ['finding_count'], 0),
      summary: str(r, ['summary']),
      model: str(r, ['model']),
    }))
  }
  if (alertRes.error) failures.push('自動巡檢警報載入失敗')
  else {
    alerts = ((alertRes.data ?? []) as unknown as Row[]).map((r) => {
      const sev = str(r, ['severity'])
      const detail = typeof r.detail === 'object' && r.detail !== null ? (r.detail as Record<string, unknown>) : {}
      const ai = typeof detail.ai === 'object' && detail.ai !== null ? (detail.ai as Record<string, unknown>) : null
      return {
        key: String(r.alert_key),
        severity: isSeverity(sev) ? sev : 'medium',
        title: str(r, ['title']) ?? '',
        detail: typeof detail.text === 'string' ? detail.text : '',
        critical: detail.critical === true,
        firstSeenAt: str(r, ['first_seen_at']) ?? '',
        lastEmailedAt: str(r, ['last_emailed_at']),
        aiAnswer: ai && typeof ai.answer === 'string' ? ai.answer : null,
        aiModel: ai && typeof ai.model === 'string' ? ai.model : null,
        aiReason: ai && ai.investigated === false && typeof ai.reason === 'string' && ai.reason !== '' ? ai.reason : null,
      }
    })
  }
  return { runs, alerts, error: failures.length > 0 ? failures.join('；') : null }
}

export async function getBugReports(): Promise<{ rows: BugReportRow[]; error: string | null }> {
  const service = getLegacyServiceSupabase()
  const { data, error } = await service
    .from('admin_bug_reports')
    .select('id, created_at, reporter_email, severity, title, description, page_url, viewport, user_agent, has_screenshot, status, email_sent_at, email_error, context')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { rows: [], error: '問題回報載入失敗' }
  const rows = ((data ?? []) as unknown as Row[]).map((r): BugReportRow => {
    const ctx = typeof r.context === 'object' && r.context !== null ? (r.context as Record<string, unknown>) : {}
    const list = Array.isArray(ctx.recentErrors) ? ctx.recentErrors : []
    const sev = str(r, ['severity'])
    const status = str(r, ['status'])
    return {
      id: String(r.id),
      createdAt: str(r, ['created_at']) ?? '',
      reporter: str(r, ['reporter_email']) ?? '',
      severity: sev === 'urgent' || sev === 'idea' ? sev : 'annoying',
      title: str(r, ['title']) ?? '',
      description: str(r, ['description']) ?? '',
      pageUrl: str(r, ['page_url']),
      viewport: str(r, ['viewport']),
      userAgent: str(r, ['user_agent']),
      hasScreenshot: r.has_screenshot === true,
      status: status === 'resolved' || status === 'in_progress' ? status : 'open',
      emailSentAt: str(r, ['email_sent_at']),
      emailError: str(r, ['email_error']),
      recentErrors: list
        .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
        .map((e) => ({
          at: typeof e.at === 'string' ? e.at : null,
          source: typeof e.source === 'string' ? e.source : null,
          message: typeof e.message === 'string' ? e.message : '',
        })),
    }
  })
  return { rows, error: null }
}
