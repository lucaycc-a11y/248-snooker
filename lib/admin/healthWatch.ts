import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { mimoChat } from '@/lib/ai/mimo'
import { adminMailShell, escapeHtml, sendAdminMail } from '@/lib/admin/alertMail'
import { runRevenueCheck, type CheckSeverity, type FindingKind } from '@/lib/admin/revenueCheck'

// 自動巡檢 — runs from the scheduler every few minutes. Read-only apart from its own
// bookkeeping table (admin_alerts). It looks for:
//   • customers who could not pay (failed KPay attempts in the last hour)
//   • money problems found by the revenue check (today + yesterday)
//   • bursts of site errors (door-card errors are excluded on purpose)
// and emails the owner. Only CRITICAL money problems go to every active admin.

/** Very special problems → every active admin. Keep this list short. */
export const CRITICAL_KINDS: ReadonlySet<FindingKind> = new Set<FindingKind>(['paid_not_confirmed', 'duplicate_payment'])

const FAILED_PAYMENT_WINDOW_MIN = 60
const ERROR_WINDOW_MIN = 60
const ERROR_SPIKE_THRESHOLD = 3
const CRITICAL_REMIND_HOURS = 12

export type WatchAlert = {
  key: string
  severity: CheckSeverity
  title: string
  detail: string
  critical: boolean
}

export type WatchResult = {
  alerts: number
  newAlerts: number
  emailedOwner: number
  emailedAdmins: number
  resolved: number
  errors: string[]
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
  const bookingIds = attempts.map((a) => str(a, ['booking_id'])).filter((v): v is string => v !== null)
  const info = new Map<string, { code: string | null; isTest: boolean }>()
  if (bookingIds.length > 0) {
    const { data: rows, error: bErr } = await service
      .from('bookings')
      .select('id, human_code, is_test')
      .in('id', bookingIds)
    if (bErr) throw new Error(`預約載入失敗：${bErr.message}`)
    for (const r of (rows ?? []) as unknown as Row[]) {
      info.set(String(r.id), { code: str(r, ['human_code']), isTest: r.is_test === true })
    }
  }

  const alerts: WatchAlert[] = []
  for (const a of attempts) {
    const userId = str(a, ['user_id'])
    const bookingId = str(a, ['booking_id'])
    const b = bookingId ? info.get(bookingId) : undefined
    if ((userId && hidden.ids.has(userId)) || b?.isTest) continue
    const reason = [str(a, ['failure_code']), str(a, ['failure_reason'])].filter(Boolean).join(' · ') || '沒有原因記錄'
    alerts.push({
      key: `payment_failed:${String(a.id)}`,
      severity: 'medium',
      critical: false,
      title: `客人付款失敗${b?.code ? `（${b.code}）` : ''}`,
      detail: `${str(a, ['provider']) ?? 'KPay'}：${reason}`.slice(0, 240),
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
      severity: 'medium',
      critical: false,
      title: `網站錯誤增加：${source}（過去 ${ERROR_WINDOW_MIN} 分鐘 ${g.count} 次）`,
      detail: g.sample.slice(0, 240),
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
      severity: f.severity,
      critical: CRITICAL_KINDS.has(f.kind),
      title: f.title,
      detail: f.detail,
    }))
}

function listHtml(alerts: WatchAlert[]): string {
  return `<ul style="padding-left:18px;line-height:1.7">${alerts
    .map((a) => `<li><b>${escapeHtml(a.title)}</b><br><span style="color:#51605a">${escapeHtml(a.detail)}</span></li>`)
    .join('')}</ul>`
}

export async function runHealthWatch(): Promise<WatchResult> {
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

  // De-duplicate by key within this run.
  const alerts = [...new Map(collected.map((a) => [a.key, a])).values()]
  const nowIso = new Date().toISOString()

  // Existing bookkeeping rows.
  const { data: existingRows, error: existingError } = await service
    .from('admin_alerts')
    .select('alert_key, last_emailed_at, resolved_at')
  if (existingError) {
    errors.push(`警報記錄載入失敗：${existingError.message}`)
    return { alerts: alerts.length, newAlerts: 0, emailedOwner: 0, emailedAdmins: 0, resolved: 0, errors }
  }
  const existing = new Map<string, { emailedAt: string | null; resolvedAt: string | null }>()
  for (const r of (existingRows ?? []) as unknown as Row[]) {
    existing.set(String(r.alert_key), { emailedAt: str(r, ['last_emailed_at']), resolvedAt: str(r, ['resolved_at']) })
  }

  const emailable: WatchAlert[] = []
  let newAlerts = 0
  for (const a of alerts) {
    const prev = existing.get(a.key)
    const isNew = !prev || prev.resolvedAt !== null
    if (isNew) newAlerts += 1
    const emailedAgoH = prev?.emailedAt ? (Date.now() - new Date(prev.emailedAt).getTime()) / 3_600_000 : null
    const due = !prev || prev.resolvedAt !== null || prev.emailedAt === null || (a.critical && (emailedAgoH ?? 0) >= CRITICAL_REMIND_HOURS)
    if (due) emailable.push(a)
    const { error } = await service.from('admin_alerts').upsert(
      {
        alert_key: a.key,
        severity: a.severity,
        title: a.title,
        detail: { text: a.detail, critical: a.critical },
        last_seen_at: nowIso,
        resolved_at: null,
        ...(isNew ? { first_seen_at: nowIso, last_emailed_at: null } : {}),
      },
      { onConflict: 'alert_key' },
    )
    if (error) errors.push(`警報寫入失敗：${error.message}`)
  }

  // Alerts no longer present are resolved (no email).
  const current = new Set(alerts.map((a) => a.key))
  const stale = [...existing.entries()].filter(([key, v]) => v.resolvedAt === null && !current.has(key)).map(([key]) => key)
  let resolved = 0
  if (stale.length > 0 && errors.length === 0) {
    const { error } = await service.from('admin_alerts').update({ resolved_at: nowIso }).in('alert_key', stale)
    if (error) errors.push(`警報結案失敗：${error.message}`)
    else resolved = stale.length
  }

  // Emails.
  const critical = emailable.filter((a) => a.critical)
  const ordinary = emailable.filter((a) => !a.critical)
  let emailedAdmins = 0
  let emailedOwner = 0

  if (critical.length > 0) {
    try {
      const out = await sendAdminMail({
        audience: 'all-admins',
        subject: `【緊急】Space8 付款異常：${critical.length} 項需要立即處理`,
        html: adminMailShell(
          '付款異常，需要立即處理',
          `<p>系統發現以下付款問題，客人可能已付款但未得到預約，或被重複扣款。請盡快到 KPay 後台核實，再在後台處理。</p>${listHtml(critical)}<p><a href="https://space8.com.hk/admin/payment-log">開啟付款監控</a> · <a href="https://space8.com.hk/admin/revenue-check">開啟收入核對</a></p>`,
          'critical',
        ),
      })
      emailedAdmins = out.recipients.length
      await service.from('admin_alerts').update({ last_emailed_at: nowIso }).in('alert_key', critical.map((a) => a.key))
    } catch (err) {
      errors.push(`緊急電郵失敗：${err instanceof Error ? err.message : '失敗'}`)
    }
  }

  if (ordinary.length > 0) {
    let intro = ''
    try {
      const out = await mimoChat({
        system: '你是 Space8 後台助手。用繁體中文書面語，以不超過 100 字概括以下警報，只可引用資料內的內容，不可新增數字，不要說已處理。',
        user: JSON.stringify(ordinary.map((a) => ({ title: a.title, detail: a.detail }))),
        maxTokens: 300,
        timeoutMs: 15_000,
      })
      intro = `<p style="background:#f2f7f4;padding:12px 14px;border-radius:10px">${escapeHtml(out.text)}</p>`
    } catch {
      intro = ''
    }
    try {
      await sendAdminMail({
        audience: 'owner',
        subject: `Space8 自動巡檢：${ordinary.length} 項需要留意`,
        html: adminMailShell('自動巡檢發現問題', `${intro}${listHtml(ordinary)}<p><a href="https://space8.com.hk/admin/revenue-check">開啟收入核對</a></p>`),
      })
      emailedOwner = 1
      await service.from('admin_alerts').update({ last_emailed_at: nowIso }).in('alert_key', ordinary.map((a) => a.key))
    } catch (err) {
      errors.push(`電郵失敗：${err instanceof Error ? err.message : '失敗'}`)
    }
  }

  return { alerts: alerts.length, newAlerts, emailedOwner, emailedAdmins, resolved, errors }
}
