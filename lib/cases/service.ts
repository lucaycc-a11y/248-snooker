import crypto from 'node:crypto'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { isTestBooking } from '@/lib/env/test-booking'
import { sendCaseEmail, type CaseEmailKind } from './email'
import { SCENARIOS, isCaseScenario, type CaseScenario, type CaseStatus } from './scenarios'

// Violation cases (違規個案): create → notify (email + inbox + optional blacklist) → member pays
// through KPay hosted cashier → case closes. Money handling lives in ./pay and ./settle;
// everything an admin or Spark does to a case goes through this file so it is audited once.

export type CaseActor = { adminId: string | null; adminEmail: string }

export type CaseRow = {
  id: string
  case_no: string
  user_id: string
  booking_id: string | null
  scenario: CaseScenario
  title: string
  detail: string | null
  evidence_note: string | null
  amount: number
  status: CaseStatus
  apply_blacklist: boolean
  pay_token: string
  incident_at: string | null
  due_at: string | null
  notified_at: string | null
  reminders_sent: number
  last_reminder_at: string | null
  paid_at: string | null
  waived_reason: string | null
  created_by_email: string | null
  is_test: boolean
  created_at: string
}

export const CASE_COLUMNS =
  'id, case_no, user_id, booking_id, scenario, title, detail, evidence_note, amount, status, apply_blacklist, pay_token, incident_at, due_at, notified_at, reminders_sent, last_reminder_at, paid_at, waived_reason, created_by_email, is_test, created_at'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : 0)

export function toCaseRow(r: unknown): CaseRow | null {
  if (!isRec(r) || typeof r.id !== 'string') return null
  const scenario = isCaseScenario(r.scenario) ? r.scenario : 'other'
  return {
    id: r.id,
    case_no: str(r.case_no),
    user_id: str(r.user_id),
    booking_id: strOrNull(r.booking_id),
    scenario,
    title: str(r.title),
    detail: strOrNull(r.detail),
    evidence_note: strOrNull(r.evidence_note),
    amount: num(r.amount),
    status: str(r.status) as CaseStatus,
    apply_blacklist: r.apply_blacklist === true,
    pay_token: str(r.pay_token),
    incident_at: strOrNull(r.incident_at),
    due_at: strOrNull(r.due_at),
    notified_at: strOrNull(r.notified_at),
    reminders_sent: num(r.reminders_sent),
    last_reminder_at: strOrNull(r.last_reminder_at),
    paid_at: strOrNull(r.paid_at),
    waived_reason: strOrNull(r.waived_reason),
    created_by_email: strOrNull(r.created_by_email),
    is_test: r.is_test === true,
    created_at: str(r.created_at),
  }
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk').replace(/\/$/, '')
}

export const casePayUrl = (token: string): string => `${siteUrl()}/pay/case/${token}`

const round2 = (n: number): number => Math.round(n * 100) / 100

export type CreateCaseInput = {
  userId: string
  bookingId?: string | null
  scenario: CaseScenario
  title?: string
  detail: string
  evidenceNote?: string
  amount: number
  applyBlacklist: boolean
  incidentAt?: string | null
  dueDays?: number
}

/** Returns an error message, or null when the input is acceptable. Shared by admin UI and Spark. */
export function validateCaseInput(i: CreateCaseInput): string | null {
  if (!isCaseScenario(i.scenario)) return '未知的違規情境'
  const preset = SCENARIOS[i.scenario]
  if (!Number.isFinite(i.amount) || i.amount < 0) return '金額不正確'
  if (i.amount > 20000) return '單一個案金額上限為 HK$20,000'
  if (i.amount !== 0 && i.amount < preset.minChargeAmount) {
    return `${preset.label}最低收費為 HK$${preset.minChargeAmount}（僅警告請填 0）`
  }
  if (i.amount > 0 && i.amount < 1.5) return 'KPay 最低收款為 HK$1.5'
  if (i.detail.trim().length < 5) return '請簡述違規事實（至少 5 個字）'
  if (i.detail.length > 1000) return '事實描述請控制在 1000 字內'
  if (i.dueDays !== undefined && (!Number.isInteger(i.dueDays) || i.dueDays < 1 || i.dueDays > 60)) return '繳付期限須為 1–60 日'
  if (i.incidentAt && Number.isNaN(new Date(i.incidentAt).getTime())) return '事發時間格式不正確'
  return null
}

type MemberLite = { id: string; email: string | null; display_name: string | null; member_code: string | null; is_blacklisted: boolean }

async function loadMember(userId: string): Promise<MemberLite | null> {
  const { data } = await getLegacyServiceSupabase()
    .from('users')
    .select('id, email, display_name, member_code, is_blacklisted, is_deleted')
    .eq('id', userId)
    .maybeSingle()
  if (!isRec(data) || data.is_deleted === true) return null
  return {
    id: str(data.id),
    email: strOrNull(data.email),
    display_name: strOrNull(data.display_name),
    member_code: strOrNull(data.member_code),
    is_blacklisted: data.is_blacklisted === true,
  }
}

export async function loadCase(id: string): Promise<CaseRow | null> {
  const { data } = await getLegacyServiceSupabase().from('violation_cases').select(CASE_COLUMNS).eq('id', id).maybeSingle()
  return toCaseRow(data)
}

export async function loadCaseByToken(token: string): Promise<CaseRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null
  const { data } = await getLegacyServiceSupabase().from('violation_cases').select(CASE_COLUMNS).eq('pay_token', token).maybeSingle()
  return toCaseRow(data)
}

function newCaseNo(): string {
  const d = new Date(Date.now() + 8 * 3600_000)
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return `VC-${ymd}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string }

export async function createCase(input: CreateCaseInput, actor: CaseActor): Promise<Outcome<CaseRow>> {
  const invalid = validateCaseInput(input)
  if (invalid) return { ok: false, error: invalid }
  const preset = SCENARIOS[input.scenario]
  const db = getLegacyServiceSupabase()

  const member = await loadMember(input.userId)
  if (!member) return { ok: false, error: '找不到此會員' }
  if (!member.email) return { ok: false, error: '此會員沒有 email，無法發送通知' }

  if (input.bookingId) {
    const { data: b } = await db.from('bookings').select('id, user_id').eq('id', input.bookingId).maybeSingle()
    if (!isRec(b) || b.user_id !== input.userId) return { ok: false, error: '此預約不屬於該會員' }
  }

  const isTest = isTestBooking(new URL(siteUrl()).hostname)
  const dueDays = input.dueDays ?? preset.dueDays
  let lastError = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('violation_cases')
      .insert({
        case_no: newCaseNo(),
        user_id: input.userId,
        booking_id: input.bookingId ?? null,
        scenario: input.scenario,
        title: (input.title?.trim() || preset.label).slice(0, 80),
        detail: input.detail.trim(),
        evidence_note: input.evidenceNote?.trim() ? input.evidenceNote.trim().slice(0, 500) : null,
        amount: round2(input.amount),
        status: 'draft',
        apply_blacklist: input.applyBlacklist,
        pay_token: crypto.randomBytes(24).toString('base64url'),
        incident_at: input.incidentAt ?? null,
        due_at: new Date(Date.now() + dueDays * 86400_000).toISOString(),
        created_by: actor.adminId,
        created_by_email: actor.adminEmail,
        is_test: isTest,
      })
      .select(CASE_COLUMNS)
      .single()
    if (!error) {
      const row = toCaseRow(data)
      if (!row) return { ok: false, error: '建立個案失敗' }
      await writeAdminAudit({
        adminUserId: actor.adminId, adminEmail: actor.adminEmail, action: 'violation_case_created',
        targetTable: 'violation_cases', targetId: row.id, beforeValue: null,
        afterValue: { caseNo: row.case_no, scenario: row.scenario, amount: row.amount, applyBlacklist: row.apply_blacklist, userId: row.user_id },
      })
      return { ok: true, value: row }
    }
    lastError = error.message
    if (error.code !== '23505') break // only retry a case_no / token collision
  }
  console.error('[cases/create] insert failed', lastError)
  return { ok: false, error: '建立個案失敗' }
}

async function emailDataFor(c: CaseRow, member: MemberLite, blacklisted: boolean) {
  return {
    to: member.email ?? '',
    memberName: member.display_name ?? '',
    caseNo: c.case_no,
    scenario: c.scenario,
    title: c.title,
    detail: c.detail,
    amount: c.amount,
    incidentAt: c.incident_at,
    dueAt: c.due_at,
    payUrl: casePayUrl(c.pay_token),
    blacklisted,
  }
}

async function inboxMessage(userId: string, title: string, message: string): Promise<void> {
  const { error } = await getLegacyServiceSupabase()
    .from('admin_notifications')
    .insert({ user_id: userId, title, message, type: 'system', read: false })
  if (error) console.error('[cases/inbox] insert failed', error.message)
}

/**
 * Send the case notice. Email goes first: if it fails nothing else changes (no blacklist, no status),
 * so a member is never suspended without having been told. Safe to call again to re-send.
 */
export async function notifyCase(caseId: string, actor: CaseActor): Promise<Outcome<{ emailId: string | null; blacklisted: boolean }>> {
  const c = await loadCase(caseId)
  if (!c) return { ok: false, error: '找不到個案' }
  if (c.status === 'paid' || c.status === 'waived' || c.status === 'cancelled') return { ok: false, error: `個案已${c.status === 'paid' ? '繳付' : c.status === 'waived' ? '豁免' : '取消'}，不能再發送` }
  const member = await loadMember(c.user_id)
  if (!member?.email) return { ok: false, error: '會員沒有可用的 email' }

  const willBlacklist = c.apply_blacklist
  const sent = await sendCaseEmail('notice', await emailDataFor(c, member, willBlacklist))
  if (!sent.ok) return { ok: false, error: `Email 發送失敗：${sent.error}` }

  const db = getLegacyServiceSupabase()
  const isWarning = c.amount === 0
  const nextStatus: CaseStatus = isWarning ? 'waived' : c.status === 'overdue' ? 'overdue' : 'notified'
  const update: Rec = {
    notified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: nextStatus,
  }
  if (isWarning) update.waived_reason = '僅警告，毋須繳費'
  const { error } = await db.from('violation_cases').update(update).eq('id', c.id)
  if (error) console.error('[cases/notify] status update failed', error.message)

  if (willBlacklist && !member.is_blacklisted) {
    const { error: blErr } = await db.from('users').update({ is_blacklisted: true }).eq('id', c.user_id)
    if (blErr) console.error('[cases/notify] blacklist failed', blErr.message)
    else {
      await writeAdminAudit({
        adminUserId: actor.adminId, adminEmail: actor.adminEmail, action: 'member_blacklist', targetTable: 'users', targetId: c.user_id,
        beforeValue: { is_blacklisted: false }, afterValue: { is_blacklisted: true, via: 'violation_case', caseNo: c.case_no },
      })
    }
  }

  await inboxMessage(
    c.user_id,
    isWarning ? '違規警告通知' : '違規個案通知',
    isWarning
      ? `個案 ${c.case_no}：${c.title}。本次為警告，詳情已發送至你的 email。`
      : `個案 ${c.case_no}：${c.title}，費用 HK$${c.amount}。繳付連結已發送至你的 email。`,
  )
  await writeAdminAudit({
    adminUserId: actor.adminId, adminEmail: actor.adminEmail, action: 'violation_case_notified', targetTable: 'violation_cases', targetId: c.id,
    beforeValue: { status: c.status }, afterValue: { status: nextStatus, emailId: sent.id },
  })
  return { ok: true, value: { emailId: sent.id, blacklisted: willBlacklist } }
}

export async function createAndNotifyCase(input: CreateCaseInput, actor: CaseActor): Promise<Outcome<{ case: CaseRow; blacklisted: boolean }>> {
  const created = await createCase(input, actor)
  if (!created.ok) return created
  const notified = await notifyCase(created.value.id, actor)
  if (!notified.ok) {
    // The case exists as a draft; admin can re-send from /admin/cases.
    return { ok: false, error: `個案 ${created.value.case_no} 已建立但尚未發送：${notified.error}` }
  }
  return { ok: true, value: { case: created.value, blacklisted: notified.value.blacklisted } }
}

/** Waive (admin forgives the fee) or cancel (opened by mistake). Never touches the blacklist. */
export async function closeCase(caseId: string, kind: 'waive' | 'cancel', reason: string, actor: CaseActor): Promise<Outcome<CaseRow>> {
  if (reason.trim().length < 5) return { ok: false, error: '原因至少要有 5 個字' }
  const c = await loadCase(caseId)
  if (!c) return { ok: false, error: '找不到個案' }
  if (c.status === 'paid' || c.status === 'waived' || c.status === 'cancelled') return { ok: false, error: '個案已結案' }
  const db = getLegacyServiceSupabase()
  const now = new Date().toISOString()
  const status: CaseStatus = kind === 'waive' ? 'waived' : 'cancelled'
  const { error } = await db.from('violation_cases').update({ status, waived_reason: reason.trim(), updated_at: now }).eq('id', c.id)
  if (error) return { ok: false, error: '更新個案失敗' }
  // A live hosted-cashier order must not stay payable once the case is closed.
  await db.from('violation_case_payments').update({ status: 'closed', updated_at: now, completed_at: now }).eq('case_id', c.id).in('status', ['creating', 'pending'])
  if (kind === 'waive' && c.amount > 0) await inboxMessage(c.user_id, '違規個案已豁免', `個案 ${c.case_no}（${c.title}）的費用已獲豁免，毋須繳付。`)
  await writeAdminAudit({
    adminUserId: actor.adminId, adminEmail: actor.adminEmail, action: kind === 'waive' ? 'violation_case_waived' : 'violation_case_cancelled',
    targetTable: 'violation_cases', targetId: c.id, beforeValue: { status: c.status }, afterValue: { status, reason: reason.trim() },
  })
  return { ok: true, value: { ...c, status, waived_reason: reason.trim() } }
}

/**
 * Daily sweep: remind once ~24h before the due date, then mark overdue and send one overdue notice.
 * Never blacklists or charges anything by itself — escalation after overdue stays a human decision.
 */
export async function runCaseSweep(now: Date = new Date()): Promise<{ reminded: number; overdue: number; errors: string[] }> {
  const db = getLegacyServiceSupabase()
  const errors: string[] = []
  let reminded = 0
  let overdue = 0
  const { data } = await db.from('violation_cases').select(CASE_COLUMNS).in('status', ['notified']).not('due_at', 'is', null).limit(200)
  for (const raw of (data ?? []) as unknown[]) {
    const c = toCaseRow(raw)
    if (!c || !c.due_at || c.amount <= 0) continue
    const msLeft = new Date(c.due_at).getTime() - now.getTime()
    let kind: CaseEmailKind | null = null
    if (msLeft < 0) kind = 'overdue'
    else if (msLeft < 86400_000 && c.reminders_sent === 0) kind = 'reminder'
    if (!kind) continue
    const member = await loadMember(c.user_id)
    if (!member?.email) { errors.push(`${c.case_no}: no email`); continue }
    const sent = await sendCaseEmail(kind, await emailDataFor(c, member, member.is_blacklisted))
    if (!sent.ok) { errors.push(`${c.case_no}: ${sent.error}`); continue }
    const stamp = now.toISOString()
    if (kind === 'overdue') {
      await db.from('violation_cases').update({ status: 'overdue', updated_at: stamp, last_reminder_at: stamp }).eq('id', c.id)
      await inboxMessage(c.user_id, '違規個案費用已逾期', `個案 ${c.case_no}（${c.title}）費用 HK$${c.amount} 已逾期，請盡快繳付。`)
      overdue++
    } else {
      await db.from('violation_cases').update({ reminders_sent: c.reminders_sent + 1, last_reminder_at: stamp, updated_at: stamp }).eq('id', c.id)
      await inboxMessage(c.user_id, '違規個案繳付提醒', `個案 ${c.case_no}（${c.title}）費用 HK$${c.amount} 將於明天到期。`)
      reminded++
    }
  }
  return { reminded, overdue, errors }
}
