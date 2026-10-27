import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { mimoChat } from '@/lib/ai/mimo'
import { adminMailShell, escapeHtml, mailButton, mailCallout, mailItems, mailText, sendAdminMail } from '@/lib/admin/alertMail'
import { runRevenueCheck, type CheckSeverity, type FindingKind } from '@/lib/admin/revenueCheck'
import { runAgent, triageEvent, type AgentResult, type Triage } from '@/lib/admin/agent'

// 自動巡檢 — runs from the scheduler every few minutes. Read-only apart from its own
// bookkeeping (admin_alerts, admin_ai_runs) and email.
//
//   1. Detect: failed customer payments (last hour), money findings from the revenue check
//      (today + yesterday), bursts of site errors (door-card errors excluded on purpose).
//   2. Email: very special money problems (paid but not booked, double charge) go to EVERY
//      active admin immediately, with no AI in the way. Everything else goes to the owner.
//   3. Think: for each NEW alert the fast model decides "is an investigation worth it?"
//      (critical money problems skip this and are always investigated). If yes, the stronger
//      model investigates with read-only tools and the diagnosis is added to the email and the
//      alert on the 收入核對 page. Capped per run and per day.

/** Very special problems → every active admin. Keep this list short. */
export const CRITICAL_KINDS: ReadonlySet<string> = new Set<FindingKind>(['paid_not_confirmed', 'duplicate_payment'])

const FAILED_PAYMENT_WINDOW_MIN = 60
const ERROR_WINDOW_MIN = 60
const ERROR_SPIKE_THRESHOLD = 3
const CRITICAL_REMIND_HOURS = 12
const MAX_TRIAGE_PER_RUN = 6
const MAX_INVESTIGATIONS_PER_RUN = 3
const DAILY_AUTO_INVESTIGATION_CAP = 30
const RUN_BUDGET_MS = 42_000

export type WatchAlert = {
  key: string
  kind: string
  severity: CheckSeverity
  title: string
  detail: string
  critical: boolean
  /** Facts handed to the triage / investigation. No names, phones or emails. */
  facts: Record<string, unknown>
}

export type WatchResult = {
  alerts: number
  newAlerts: number
  triaged: number
  investigated: number
  emailedOwner: number
  emailedAdmins: number
  resolved: number
  errors: string[]
}

type AlertAi = {
  investigated: boolean
  reason: string
  answer: string | null
  model: string | null
  runId: string | null
  error: string | null
}

function hkDate(offsetDays = 0): string {
  return new Date(Date.now() + 8 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

function hkHourBucket(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 13)
}

async function collectFailedPayments(): Promise<WatchAlert[]> {
  const service = getLegacyServiceSupabase()
  const since = new Date(Date.now() - FAILED_PAYMENT_WINDOW_MIN * 60_000).toISOString()
  const { data, error } = await service
    .from('payment_attempts')
    .select('id, booking_id, user_id, provider, failure_code, failure_reason, created_at')
    .eq('status', 'failed')
    .gte('created_at', since)
    .limit(50)
  if (error) throw new Error(`付款失敗記錄載入失敗：${error.message}`)
  const attempts = (data ?? []) as unknown as Row[]
  if (attempts.length === 0) return []

  const hidden = await getHiddenUserList()
  const bookingIds = [...new Set(attempts.map((a) => str(a, ['booking_id'])).filter((v): v is string => v !== null))]
  const userIds = [...new Set(attempts.map((a) => str(a, ['user_id'])).filter((v): v is string => v !== null))]

  const info = new Map<string, { code: string | null; isTest: boolean; status: string | null; method: string | null }>()
  const laterSuccess = new Set<string>()
  if (bookingIds.length > 0) {
    const [{ data: rows, error: bErr }, { data: okRows, error: okErr }] = await Promise.all([
      service.from('bookings').select('id, human_code, is_test, status, payment_method').in('id', bookingIds),
      service.from('payment_attempts').select('booking_id, created_at').eq('status', 'succeeded').in('booking_id', bookingIds),
    ])
    if (bErr) throw new Error(`預約載入失敗：${bErr.message}`)
    if (okErr) throw new Error(`成功付款記錄載入失敗：${okErr.message}`)
    for (const r of (rows ?? []) as unknown as Row[]) {
      info.set(String(r.id), { code: str(r, ['human_code']), isTest: r.is_test === true, status: str(r, ['status']), method: str(r, ['payment_method']) })
    }
    for (const r of (okRows ?? []) as unknown as Row[]) {
      const id = str(r, ['booking_id'])
      if (id) laterSuccess.add(id)
    }
  }
  // Each user's failures in the last 24h — repeated failure is a signal the triage should see.
  const failures24h = new Map<string, number>()
  if (userIds.length > 0) {
    const { data: rows, error: fErr } = await service
      .from('payment_attempts')
      .select('user_id')
      .eq('status', 'failed')
      .in('user_id', userIds)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    if (fErr) throw new Error(`失敗次數載入失敗：${fErr.message}`)
    for (const r of (rows ?? []) as unknown as Row[]) {
      const u = str(r, ['user_id'])
      if (u) failures24h.set(u, (failures24h.get(u) ?? 0) + 1)
    }
  }

  const alerts: WatchAlert[] = []
  for (const a of attempts) {
    const userId = str(a, ['user_id'])
    const bookingId = str(a, ['booking_id'])
    const b = bookingId ? info.get(bookingId) : undefined
    if ((userId && hidden.ids.has(userId)) || b?.isTest) continue
    // The customer tried again and paid: nothing for the owner to do.
    if (bookingId && (laterSuccess.has(bookingId) || b?.status === 'confirmed')) continue
    const reason = [str(a, ['failure_code']), str(a, ['failure_reason'])].filter(Boolean).join(' · ') || '沒有原因記錄'
    const provider = str(a, ['provider']) ?? 'KPay'
    alerts.push({
      key: `payment_failed:${String(a.id)}`,
      kind: 'payment_failed',
      severity: 'medium',
      critical: false,
      title: `客人付款失敗${b?.code ? `（${b.code}）` : ''}${b?.method ? ` · ${b.method}` : ''}`,
      detail: `${provider}：${reason}`.slice(0, 240),
      facts: {
        booking: b?.code ?? null,
        bookingStatus: b?.status ?? null,
        method: b?.method ?? null,
        provider,
        failureCode: str(a, ['failure_code']),
        failureReason: str(a, ['failure_reason']),
        minutesAgo: Math.floor((Date.now() - new Date(str(a, ['created_at']) ?? Date.now()).getTime()) / 60_000),
        sameCustomerFailuresLast24h: userId ? failures24h.get(userId) ?? 1 : null,
        customerLaterPaid: false,
      },
    })
  }
  return alerts
}

async function collectErrorSpikes(): Promise<WatchAlert[]> {
  const service = getLegacyServiceSupabase()
  const since = new Date(Date.now() - ERROR_WINDOW_MIN * 60_000).toISOString()
  const { data, error } = await service
    .from('site_error_log')
    .select('source, message, created_at')
    .eq('severity', 'error')
    .eq('resolved', false)
    .gte('created_at', since)
    .limit(500)
  if (error) throw new Error(`錯誤記錄載入失敗：${error.message}`)
  const groups = new Map<string, { count: number; sample: string }>()
  for (const r of (data ?? []) as unknown as Row[]) {
    const source = str(r, ['source']) ?? '未知來源'
    if (source.startsWith('admin.door')) continue // 門禁卡 errors are tracked separately, on purpose.
    const g = groups.get(source) ?? { count: 0, sample: str(r, ['message']) ?? '' }
    g.count += 1
    groups.set(source, g)
  }
  const alerts: WatchAlert[] = []
  for (const [source, g] of groups) {
    if (g.count < ERROR_SPIKE_THRESHOLD) continue
    alerts.push({
      key: `error_spike:${source}:${hkHourBucket()}`,
      kind: 'error_spike',
      severity: 'medium',
      critical: false,
      title: `網站錯誤增加：${source}（過去 ${ERROR_WINDOW_MIN} 分鐘 ${g.count} 次）`,
      detail: g.sample.slice(0, 240),
      facts: { source, count: g.count, windowMinutes: ERROR_WINDOW_MIN, sampleMessage: g.sample.slice(0, 200) },
    })
  }
  return alerts
}

async function collectMoneyFindings(): Promise<WatchAlert[]> {
  const result = await runRevenueCheck({ from: hkDate(-1), to: hkDate(0) })
  if (result.error && !result.totals) throw new Error(result.error)
  return result.findings
    .filter((f) => f.severity !== 'low')
    .map((f) => ({
      key: f.id,
      kind: f.kind,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      critical: CRITICAL_KINDS.has(f.kind),
      facts: { kind: f.kind, booking: f.code, evidence: f.evidence },
    }))
}

function investigationPrompt(a: WatchAlert): string {
  const base = `事件類型：${a.kind}\n標題：${a.title}\n詳情：${a.detail}\n已知事實：${JSON.stringify(a.facts)}\n\n`
  if (a.kind === 'payment_failed') {
    return `${base}有客人付款失敗。請查證：該預約的狀態和付款嘗試、KPay 有沒有收到付款通知、同一客人近期的付款歷史、該時段是否已被佔用、近期有沒有相關系統錯誤。判斷屬於：客人自行取消／餘額或限額問題／系統或 KPay 問題／其他，並說明客人是否可能已被扣款但未得到預約。`
  }
  if (a.kind === 'error_spike') {
    return `${base}網站錯誤突然增加。請查最近的錯誤分佈，並看有沒有影響付款或預約（查付款嘗試和 KPay 通知），判斷影響範圍和嚴重程度。`
  }
  return `${base}請查證這項異常是否屬實，查看相關預約的付款嘗試、事件和 KPay 通知，說明原因和下一步。`
}

async function investigationsToday(): Promise<number> {
  const service = getLegacyServiceSupabase()
  const dayStart = new Date(`${hkDate()}T00:00:00+08:00`).toISOString()
  const { count } = await service
    .from('admin_ai_runs')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'auto')
    .gte('created_at', dayStart)
  return count ?? 0
}

function aiBlockHtml(ai: AlertAi | undefined): string {
  if (!ai || !ai.answer) return ''
  return mailCallout(`<b style="color:#22c55e;">AI 診斷</b>${ai.model ? ` <span style="color:#737373;">（${escapeHtml(ai.model)}）</span>` : ''}\n${escapeHtml(ai.answer)}`)
}

function listHtml(alerts: WatchAlert[], ai?: Map<string, AlertAi>): string {
  return mailItems(alerts.map((a) => ({ title: a.title, detail: a.detail, extraHtml: aiBlockHtml(ai?.get(a.key)) })))
}

export async function runHealthWatch(): Promise<WatchResult> {
  const t0 = Date.now()
  const service = getLegacyServiceSupabase()
  const errors: string[] = []
  const collected: WatchAlert[] = []

  for (const [label, fn] of [
    ['付款失敗', collectFailedPayments],
    ['錯誤增加', collectErrorSpikes],
    ['收入核對', collectMoneyFindings],
  ] as const) {
    try {
      collected.push(...(await fn()))
    } catch (err) {
      errors.push(`${label}：${err instanceof Error ? err.message : '失敗'}`)
      console.error(`[admin/health-watch] ${label} failed`, err)
    }
  }

  const alerts = [...new Map(collected.map((a) => [a.key, a])).values()]
  const nowIso = new Date().toISOString()
  const empty: WatchResult = { alerts: alerts.length, newAlerts: 0, triaged: 0, investigated: 0, emailedOwner: 0, emailedAdmins: 0, resolved: 0, errors }

  const { data: existingRows, error: existingError } = await service.from('admin_alerts').select('alert_key, last_emailed_at, resolved_at')
  if (existingError) {
    errors.push(`警報記錄載入失敗：${existingError.message}`)
    return empty
  }
  const existing = new Map<string, { emailedAt: string | null; resolvedAt: string | null }>()
  for (const r of (existingRows ?? []) as unknown as Row[]) {
    existing.set(String(r.alert_key), { emailedAt: str(r, ['last_emailed_at']), resolvedAt: str(r, ['resolved_at']) })
  }

  const emailable: WatchAlert[] = []
  const fresh: WatchAlert[] = []
  for (const a of alerts) {
    const prev = existing.get(a.key)
    const isNew = !prev || prev.resolvedAt !== null
    if (isNew) fresh.push(a)
    const emailedAgoH = prev?.emailedAt ? (Date.now() - new Date(prev.emailedAt).getTime()) / 3_600_000 : null
    const due = !prev || prev.resolvedAt !== null || prev.emailedAt === null || (a.critical && (emailedAgoH ?? 0) >= CRITICAL_REMIND_HOURS)
    if (due) emailable.push(a)
    const { error } = await service.from('admin_alerts').upsert(
      {
        alert_key: a.key,
        severity: a.severity,
        title: a.title,
        last_seen_at: nowIso,
        resolved_at: null,
        ...(isNew ? { detail: { text: a.detail, critical: a.critical, kind: a.kind }, first_seen_at: nowIso, last_emailed_at: null } : {}),
      },
      { onConflict: 'alert_key' },
    )
    if (error) errors.push(`警報寫入失敗：${error.message}`)
  }

  const current = new Set(alerts.map((a) => a.key))
  const stale = [...existing.entries()].filter(([key, v]) => v.resolvedAt === null && !current.has(key)).map(([key]) => key)
  let resolved = 0
  if (stale.length > 0 && errors.length === 0) {
    const { error } = await service.from('admin_alerts').update({ resolved_at: nowIso }).in('alert_key', stale)
    if (error) errors.push(`警報結案失敗：${error.message}`)
    else resolved = stale.length
  }

  // 1. Critical money problems: straight to every active admin, no AI in the way.
  const critical = emailable.filter((a) => a.critical)
  let emailedAdmins = 0
  if (critical.length > 0) {
    try {
      const out = await sendAdminMail({
        audience: 'all-admins',
        subject: `【緊急】Space8 付款異常：${critical.length} 項需要立即處理`,
        html: adminMailShell(
          '付款異常，需要立即處理',
          `${mailText('系統發現以下付款問題，客人可能已付款但未得到預約，或被重複扣款。請盡快到 KPay 後台核實，再在後台處理。')}${listHtml(critical)}${mailButton('https://space8.com.hk/admin/payment-log', '開啟付款監控')}`,
          'critical',
          `${critical.length} 項付款異常需要立即處理`,
        ),
      })
      emailedAdmins = out.recipients.length
      await service.from('admin_alerts').update({ last_emailed_at: nowIso }).in('alert_key', critical.map((a) => a.key))
    } catch (err) {
      errors.push(`緊急電郵失敗：${err instanceof Error ? err.message : '失敗'}`)
    }
  }

  // 2. Think: triage new alerts, investigate the ones worth it.
  const ai = new Map<string, AlertAi>()
  let triaged = 0
  let investigated = 0
  const candidates = [...fresh].sort((x, y) => Number(y.critical) - Number(x.critical))
  let todayCount = candidates.length > 0 && process.env.MIMO_API_KEY ? await investigationsToday().catch(() => DAILY_AUTO_INVESTIGATION_CAP) : DAILY_AUTO_INVESTIGATION_CAP

  for (const a of candidates) {
    if (!process.env.MIMO_API_KEY) break
    if (Date.now() - t0 > RUN_BUDGET_MS - 8_000) break
    if (investigated >= MAX_INVESTIGATIONS_PER_RUN || triaged >= MAX_TRIAGE_PER_RUN) break

    let decision: Triage
    if (a.critical) {
      decision = { investigate: true, reason: '涉及金錢的嚴重問題，必定調查', model: null, error: null }
    } else {
      triaged += 1
      decision = await triageEvent({ kind: a.kind, title: a.title, detail: a.detail, facts: a.facts })
    }
    const record: AlertAi = { investigated: false, reason: decision.reason, answer: null, model: decision.model, runId: null, error: decision.error }

    if (decision.investigate && todayCount < DAILY_AUTO_INVESTIGATION_CAP) {
      const result: AgentResult = await runAgent({ prompt: investigationPrompt(a), budgetMs: Math.min(30_000, RUN_BUDGET_MS - (Date.now() - t0)) })
      investigated += 1
      todayCount += 1
      record.investigated = true
      record.answer = result.answer
      record.model = result.model ?? record.model
      record.error = result.error
      const { data: run } = await service
        .from('admin_ai_runs')
        .insert({
          kind: 'auto',
          requested_by: 'health-watch',
          range_from: hkDate(),
          range_to: hkDate(),
          steps: result.steps,
          findings: [{ key: a.key, kind: a.kind, title: a.title, triage: decision.reason }],
          totals: { rounds: result.rounds },
          finding_count: 1,
          summary: result.answer,
          model: result.model,
          ai_error: result.error,
        })
        .select('id')
        .single()
      record.runId = run && typeof run === 'object' && 'id' in run ? String((run as { id: unknown }).id) : null
    }
    ai.set(a.key, record)
    await service
      .from('admin_alerts')
      .update({ detail: { text: a.detail, critical: a.critical, kind: a.kind, ai: record } })
      .eq('alert_key', a.key)
  }

  // 3. Emails to the owner: ordinary digest (with diagnoses) + diagnosis follow-up for critical ones.
  const ordinary = emailable.filter((a) => !a.critical)
  let emailedOwner = 0
  if (ordinary.length > 0) {
    let intro = ''
    try {
      const out = await mimoChat({
        task: 'explain',
        system: '你是 Space8 後台助手。用繁體中文書面語，以不超過 100 字概括以下警報，只可引用資料內的內容，不可新增數字，不要說已處理。',
        user: JSON.stringify(ordinary.map((a) => ({ title: a.title, detail: a.detail, diagnosis: ai.get(a.key)?.answer ?? null }))),
        maxTokens: 300,
        timeoutMs: 12_000,
      })
      intro = mailCallout(escapeHtml(out.text))
    } catch {
      intro = ''
    }
    try {
      await sendAdminMail({
        audience: 'owner',
        subject: `Space8 自動巡檢：${ordinary.length} 項需要留意`,
        html: adminMailShell('自動巡檢發現問題', `${intro}${listHtml(ordinary, ai)}${mailButton('https://space8.com.hk/admin/revenue-check', '開啟收入核對')}`, 'normal', `${ordinary.length} 項需要留意`),
      })
      emailedOwner += 1
      await service.from('admin_alerts').update({ last_emailed_at: nowIso }).in('alert_key', ordinary.map((a) => a.key))
    } catch (err) {
      errors.push(`電郵失敗：${err instanceof Error ? err.message : '失敗'}`)
    }
  }
  const diagnosedCritical = critical.filter((a) => ai.get(a.key)?.answer)
  if (diagnosedCritical.length > 0) {
    try {
      await sendAdminMail({
        audience: 'owner',
        subject: `【AI 診斷】${diagnosedCritical.length} 項緊急付款異常`,
        html: adminMailShell('緊急付款異常的 AI 診斷', `${mailText('以下是剛才緊急電郵的 AI 診斷，僅供參考，請以 KPay 後台為準。')}${listHtml(diagnosedCritical, ai)}`, 'critical', 'AI 診斷'),
      })
      emailedOwner += 1
    } catch (err) {
      errors.push(`診斷電郵失敗：${err instanceof Error ? err.message : '失敗'}`)
    }
  }

  return { alerts: alerts.length, newAlerts: fresh.length, triaged, investigated, emailedOwner, emailedAdmins, resolved, errors }
}
