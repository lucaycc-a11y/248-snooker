/**
 * CS 中心 core: customer lookup, cases, case notes and the automatic "website problem" email.
 * Server-side only (service role).
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { adminMailShell, escapeHtml, mailButton, mailCallout, mailFacts, mailText, sendAdminMail } from '@/lib/admin/alertMail'
import { databaseHealthSnapshot } from '@/lib/spark/csTools'
import { isCsVerdict, type CsVerdict } from './verdict'

export const CS_CATEGORIES = ['payment', 'booking', 'account', 'website', 'other'] as const
export type CsCategory = (typeof CS_CATEGORIES)[number]
export const CS_STATUSES = ['open', 'pending', 'resolved'] as const
export type CsStatus = (typeof CS_STATUSES)[number]
export const CS_NOTE_KINDS = ['note', 'otp', 'payment_link', 'reply', 'spark', 'system'] as const
export type CsNoteKind = (typeof CS_NOTE_KINDS)[number]

export const CS_CATEGORY_LABEL: Record<CsCategory, string> = {
  payment: '付款',
  booking: '預約',
  account: '帳戶',
  website: '網站問題',
  other: '其他',
}

export function isCsCategory(v: unknown): v is CsCategory {
  return typeof v === 'string' && (CS_CATEGORIES as readonly string[]).includes(v)
}
export function isCsStatus(v: unknown): v is CsStatus {
  return typeof v === 'string' && (CS_STATUSES as readonly string[]).includes(v)
}

export type CsCustomer = {
  id: string
  email: string | null
  displayName: string | null
  memberCode: string | null
  phone: string | null
}

export type CsCase = {
  id: string
  created_at: string
  updated_at: string
  status: CsStatus
  category: CsCategory
  subject: string
  detail: string | null
  user_id: string | null
  customer_email: string | null
  booking_code: string | null
  website_issue: boolean
  owner_notified_at: string | null
  auto_report_at: string | null
  identity_verified_at: string | null
  identity_skipped_at: string | null
  spark_verdict: CsVerdict | null
  created_by: string
  resolution_note: string | null
  resolved_at: string | null
  resolved_by: string | null
}

export type CsNote = { id: number; case_id: string; created_at: string; author: string; kind: CsNoteKind; body: string }

type Row = Record<string, unknown>
const db = () => getLegacyServiceSupabase()
const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function toCustomer(r: Row): CsCustomer {
  return {
    id: String(r.id),
    email: text(r.email),
    displayName: text(r.display_name),
    memberCode: text(r.member_code),
    phone: text(r.phone),
  }
}

const CUSTOMER_COLUMNS = 'id, email, display_name, member_code, phone'

export async function getCustomer(userId: string): Promise<CsCustomer | null> {
  const { data } = await db().from('users').select(CUSTOMER_COLUMNS).eq('id', userId).maybeSingle()
  return data ? toCustomer(data as Row) : null
}

/** Find a customer by member code, email, phone, name or booking code. Max 10 results. */
export async function findCustomers(raw: string): Promise<CsCustomer[]> {
  const q = raw.trim().slice(0, 80)
  if (q.length < 2) return []
  const like = q.replace(/[\\%_]/g, (c) => `\\${c}`)
  const digits = q.replace(/\D/g, '')
  const s = db()
  const jobs: PromiseLike<{ data: unknown }>[] = [
    s.from('users').select(CUSTOMER_COLUMNS).eq('member_code', q.toUpperCase()).limit(5),
    s.from('users').select(CUSTOMER_COLUMNS).ilike('email', `%${like}%`).limit(10),
    s.from('users').select(CUSTOMER_COLUMNS).ilike('display_name', `%${like}%`).limit(10),
  ]
  if (digits.length >= 6) jobs.push(s.from('users').select(CUSTOMER_COLUMNS).ilike('phone', `%${digits}%`).limit(10))
  const found = new Map<string, CsCustomer>()
  for (const r of await Promise.all(jobs)) {
    for (const row of (Array.isArray(r.data) ? r.data : []) as Row[]) found.set(String(row.id), toCustomer(row))
  }
  if (/^[A-Za-z0-9_-]{6,40}$/.test(q)) {
    const { data: b } = await s.from('bookings').select('user_id').or(`human_code.eq.${q.toUpperCase()},booking_reference.eq.${q}`).limit(1).maybeSingle()
    const uid = b ? text((b as Row).user_id) : null
    if (uid && !found.has(uid)) {
      const c = await getCustomer(uid)
      if (c) found.set(uid, c)
    }
  }
  return [...found.values()].slice(0, 10)
}

export async function addCaseNote(caseId: string, author: string, kind: CsNoteKind, body: string): Promise<void> {
  const { error } = await db().from('cs_case_notes').insert({ case_id: caseId, author, kind, body: body.slice(0, 4000) })
  if (error) console.error('[cs] note insert failed', error.message)
  await db().from('cs_cases').update({ updated_at: new Date().toISOString() }).eq('id', caseId)
}

function normalizeCase(c: CsCase): CsCase {
  return { ...c, spark_verdict: isCsVerdict(c.spark_verdict) ? c.spark_verdict : null }
}

/** Stores Spark's verdict. A confident "website: yes" flags the case (and emails the owner once). */
export async function applyVerdict(caseId: string, verdict: CsVerdict, adminEmail: string, opts: { notifyOwner: boolean }): Promise<void> {
  const patch: Record<string, unknown> = { spark_verdict: verdict, updated_at: new Date().toISOString() }
  const found = await getCase(caseId)
  if (!found) return
  const flag = verdict.website === 'yes' && !found.case.website_issue
  if (flag) patch.website_issue = true
  await db().from('cs_cases').update(patch).eq('id', caseId)
  if (flag) {
    await addCaseNote(caseId, 'Spark', 'system', 'Spark 判斷為網站問題，已自動標記')
    if (opts.notifyOwner) {
      const again = await getCase(caseId)
      if (again) await notifyOwnerWebsiteIssue(again.case, adminEmail)
    }
  }
}

export async function getCase(id: string): Promise<{ case: CsCase; notes: CsNote[]; customer: CsCustomer | null } | null> {
  const { data } = await db().from('cs_cases').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const c = normalizeCase(data as unknown as CsCase)
  const { data: notes } = await db().from('cs_case_notes').select('*').eq('case_id', id).order('created_at', { ascending: true }).limit(200)
  return { case: c, notes: (notes ?? []) as unknown as CsNote[], customer: c.user_id ? await getCustomer(c.user_id) : null }
}

export async function createCase(input: {
  admin: { email: string }
  category: CsCategory
  subject: string
  detail?: string | null
  userId?: string | null
  customerEmail?: string | null
  bookingCode?: string | null
}): Promise<CsCase> {
  const { data, error } = await db()
    .from('cs_cases')
    .insert({
      category: input.category,
      subject: input.subject.slice(0, 200),
      detail: input.detail ? input.detail.slice(0, 4000) : null,
      user_id: input.userId ?? null,
      customer_email: input.customerEmail ?? null,
      booking_code: input.bookingCode ? input.bookingCode.slice(0, 40) : null,
      website_issue: input.category === 'website',
      created_by: input.admin.email,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message ?? '建立工單失敗')
  const c = data as unknown as CsCase
  await addCaseNote(c.id, input.admin.email, 'system', `工單建立：${CS_CATEGORY_LABEL[c.category]} — ${c.subject}`)
  if (c.website_issue) await notifyOwnerWebsiteIssue(c, input.admin.email)
  return c
}

/**
 * Website problem → email the owner straight away, with a database / payment health snapshot so
 * the cause is often visible without opening anything. Sent once per case.
 * Never throws: a mail failure is recorded on the case instead.
 */
export async function notifyOwnerWebsiteIssue(c: CsCase, adminEmail: string): Promise<boolean> {
  if (c.owner_notified_at) return false
  try {
    let snapshot: Record<string, unknown> = {}
    try {
      snapshot = await databaseHealthSnapshot()
    } catch {
      snapshot = { error: '健康快照讀取失敗' }
    }
    const caseUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://space8.com.hk'}/admin/cs?case=${c.id}`
    const snap = Object.entries(snapshot)
      .filter(([k]) => k !== 'errorSourcesLast24h')
      .map(([k, v]): [string, string] => [k, String(v)])
    const sources = Array.isArray(snapshot.errorSourcesLast24h)
      ? (snapshot.errorSourcesLast24h as { source: string; n: number }[]).map((s) => `${s.source} × ${s.n}`).join('、')
      : ''
    await sendAdminMail({
      audience: 'owner',
      subject: `【客務】網站問題：${c.subject.slice(0, 60)}`,
      html: adminMailShell(
        '客務工單：網站問題',
        `${mailText(`${adminEmail} 開咗一張「網站問題」工單，需要你跟進。`)}
${mailCallout(escapeHtml(`${c.subject}\n${c.detail ?? ''}`.trim()))}
${mailFacts([
  ['預約編號', c.booking_code ?? '-'],
  ['客人電郵', c.customer_email ?? '-'],
  ['開單人', adminEmail],
  ...snap,
  ...(sources ? ([['錯誤來源（24 小時）', sources]] as [string, string][]) : []),
])}
${mailButton(caseUrl, '打開工單')}`,
        'normal',
        c.subject,
      ),
    })
    await db().from('cs_cases').update({ owner_notified_at: new Date().toISOString() }).eq('id', c.id)
    await addCaseNote(c.id, 'system', 'system', '已自動電郵通知網站負責人（含系統健康快照）')
    return true
  } catch (e) {
    await addCaseNote(c.id, 'system', 'system', `自動電郵通知失敗：${e instanceof Error ? e.message : '未知錯誤'}`)
    return false
  }
}

export async function updateCase(
  id: string,
  admin: { email: string },
  patch: { status?: CsStatus; category?: CsCategory; resolutionNote?: string | null; websiteIssue?: boolean },
): Promise<CsCase | null> {
  const before = await getCase(id)
  if (!before) return null
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status) {
    update.status = patch.status
    if (patch.status === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolved_by = admin.email
    } else {
      update.resolved_at = null
      update.resolved_by = null
    }
  }
  if (patch.category) update.category = patch.category
  if (patch.resolutionNote !== undefined) update.resolution_note = patch.resolutionNote ? patch.resolutionNote.slice(0, 2000) : null
  if (patch.websiteIssue !== undefined) update.website_issue = patch.websiteIssue
  const { data, error } = await db().from('cs_cases').update(update).eq('id', id).select('*').single()
  if (error || !data) throw new Error(error?.message ?? '更新工單失敗')
  const after = data as unknown as CsCase
  if (patch.status && patch.status !== before.case.status) {
    await addCaseNote(id, admin.email, 'system', `狀態：${before.case.status} → ${patch.status}${patch.resolutionNote ? `（${patch.resolutionNote}）` : ''}`)
  }
  if (after.website_issue && !after.owner_notified_at) await notifyOwnerWebsiteIssue(after, admin.email)
  return after
}

export async function listCases(filter: { status?: CsStatus | 'active'; q?: string }): Promise<CsCase[]> {
  let query = db().from('cs_cases').select('*').order('created_at', { ascending: false }).limit(100)
  if (filter.status === 'active') query = query.in('status', ['open', 'pending'])
  else if (filter.status) query = query.eq('status', filter.status)
  if (filter.q) {
    const like = filter.q.trim().slice(0, 60).replace(/[\\%_,()]/g, '')
    if (like) query = query.or(`subject.ilike.%${like}%,booking_code.ilike.%${like}%,customer_email.ilike.%${like}%`)
  }
  const { data } = await query
  return (data ?? []) as unknown as CsCase[]
}

/** Fills {{name}}, {{code}}, {{link}}, {{result}} in a reply template. Unknown placeholders stay visible. */
export function fillTemplate(body: string, vars: Partial<Record<'name' | 'code' | 'link' | 'result', string>>): string {
  return body.replace(/\{\{(name|code|link|result)\}\}/g, (m, k: 'name' | 'code' | 'link' | 'result') => {
    const v = vars[k]
    return v && v.trim() ? v : m
  })
}
