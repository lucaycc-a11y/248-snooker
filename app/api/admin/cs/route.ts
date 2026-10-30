/**
 * CS 中心 API (admin only).
 *
 * GET  ?view=cases&status=active|open|pending|resolved&q=   case list
 *      ?view=case&id=                                       one case with notes + customer
 *      ?view=customers&q=                                   find a customer
 *      ?view=templates                                      reply templates
 * POST { action, ... }  see ACTIONS below. Every action is audited; nothing here moves money.
 */
import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { rateLimit } from '@/lib/rate-limit'
import {
  CS_NOTE_KINDS,
  addCaseNote,
  createCase,
  fillTemplate,
  findCustomers,
  getCase,
  getCustomer,
  isCsCategory,
  isCsStatus,
  listCases,
  updateCase,
} from '@/lib/cs/core'
import { issueCsOtp, verifyCsOtp } from '@/lib/cs/otp'
import { createCsPaymentLink, emailPaymentLinkToCustomer, quoteCsSlot, refreshCsPaymentLink } from '@/lib/cs/paymentLink'
import { sparkAsk, sparkDiagnose, sparkDraftReply } from '@/lib/cs/spark'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const s = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

export const GET = withAdminSecurity(
  async (req) => {
    const url = new URL(req.url)
    const view = url.searchParams.get('view')
    if (view === 'cases') {
      const st = url.searchParams.get('status')
      const status = st === 'active' || isCsStatus(st) ? st : 'active'
      return NextResponse.json({ cases: await listCases({ status, q: s(url.searchParams.get('q'), 60) }) })
    }
    if (view === 'case') {
      const id = url.searchParams.get('id')
      if (!isUuid(id)) return err('工單編號無效')
      const found = await getCase(id)
      if (!found) return err('找不到工單', 404)
      return NextResponse.json(found)
    }
    if (view === 'customers') {
      return NextResponse.json({ customers: await findCustomers(s(url.searchParams.get('q'), 80)) })
    }
    if (view === 'templates') {
      const { data } = await getLegacyServiceSupabase().from('cs_templates').select('*').order('category').order('title')
      return NextResponse.json({ templates: data ?? [] })
    }
    return err('Unknown view')
  },
  { csrf: false },
)

type Body = Record<string, unknown>

export const POST = withAdminSecurity(
  async (req, admin) => {
    const body = (await req.json().catch(() => null)) as Body | null
    const action = typeof body?.action === 'string' ? body.action : ''
    if (!body) return err('資料無效')
    const adminEmail = admin.email ?? 'unknown'
    const caseId = isUuid(body.caseId) ? body.caseId : null
    const audit = async (actionType: string, targetId: string | undefined, after: Record<string, unknown>) => {
      try {
        await writeAdminActionLog({ adminUserId: admin.id, adminEmail, actionType, targetTable: 'cs_cases', targetId, afterJsonb: after })
      } catch {
        /* audit is best-effort */
      }
    }
    const url = new URL(req.url)

    switch (action) {
      case 'create_case': {
        const subject = s(body.subject, 200)
        if (subject.length < 3) return err('請填寫工單標題')
        const category = isCsCategory(body.category) ? body.category : 'other'
        const userId = isUuid(body.userId) ? body.userId : null
        const customer = userId ? await getCustomer(userId) : null
        const created = await createCase({
          admin: { email: adminEmail },
          category,
          subject,
          detail: s(body.detail, 4000) || null,
          userId,
          customerEmail: customer?.email ?? null,
          bookingCode: s(body.bookingCode, 40) || null,
        })
        await audit('cs_case_created', created.id, { category, subject })
        return NextResponse.json({ case: created })
      }

      case 'update_case': {
        if (!caseId) return err('工單編號無效')
        const updated = await updateCase(caseId, { email: adminEmail }, {
          status: isCsStatus(body.status) ? body.status : undefined,
          category: isCsCategory(body.category) ? body.category : undefined,
          resolutionNote: typeof body.resolutionNote === 'string' ? s(body.resolutionNote, 2000) : undefined,
          websiteIssue: typeof body.websiteIssue === 'boolean' ? body.websiteIssue : undefined,
        })
        if (!updated) return err('找不到工單', 404)
        await audit('cs_case_updated', caseId, { status: updated.status, category: updated.category, websiteIssue: updated.website_issue })
        return NextResponse.json({ case: updated })
      }

      case 'attach_customer': {
        if (!caseId || !isUuid(body.userId)) return err('資料無效')
        const customer = await getCustomer(body.userId)
        if (!customer) return err('找不到這位會員', 404)
        const { error } = await getLegacyServiceSupabase()
          .from('cs_cases')
          .update({ user_id: customer.id, customer_email: customer.email, updated_at: new Date().toISOString() })
          .eq('id', caseId)
        if (error) return err('儲存失敗', 500)
        await addCaseNote(caseId, adminEmail, 'system', `已連結會員 ${customer.memberCode ?? ''}`.trim())
        await audit('cs_case_customer_attached', caseId, { userId: customer.id })
        return NextResponse.json({ ok: true })
      }

      case 'add_note': {
        if (!caseId) return err('工單編號無效')
        const text = s(body.body, 4000)
        if (!text) return err('請輸入內容')
        const kind = typeof body.kind === 'string' && (CS_NOTE_KINDS as readonly string[]).includes(body.kind) && body.kind !== 'otp' && body.kind !== 'system' ? (body.kind as (typeof CS_NOTE_KINDS)[number]) : 'note'
        await addCaseNote(caseId, adminEmail, kind, text)
        return NextResponse.json({ ok: true })
      }

      case 'otp_send': {
        if (!isUuid(body.userId)) return err('請先選擇會員')
        const out = await issueCsOtp({ userId: body.userId, adminEmail, caseId })
        await audit('cs_otp_sent', caseId ?? undefined, { userId: body.userId, ok: out.ok })
        return out.ok ? NextResponse.json(out) : err(out.error, 400)
      }

      case 'otp_verify': {
        if (!isUuid(body.userId)) return err('請先選擇會員')
        const out = await verifyCsOtp({ userId: body.userId, code: s(body.code, 6), adminEmail, caseId })
        await audit('cs_otp_verified', caseId ?? undefined, { userId: body.userId, ok: out.ok })
        return out.ok ? NextResponse.json(out) : err(out.error, 400)
      }

      case 'link_create': {
        if (!isUuid(body.userId)) return err('請先選擇會員')
        const out = await createCsPaymentLink({
          admin: { id: admin.id, email: adminEmail },
          userId: body.userId,
          date: s(body.date, 10),
          startHour: Number(body.startHour),
          duration: Number(body.duration),
          tableNumber: Number(body.tableNumber) === 2 ? 2 : 1,
          caseId,
          customPrice: body.price === undefined || body.price === null || body.price === '' ? null : Number(body.price),
          origin: url.origin,
          hostname: url.hostname,
        })
        return out.ok ? NextResponse.json(out) : err(out.error, 409)
      }

      case 'link_quote': {
        if (!isUuid(body.userId)) return err('請先選擇會員')
        const q = await quoteCsSlot({ userId: body.userId, date: s(body.date, 10), startHour: Number(body.startHour), duration: Number(body.duration) })
        return q.ok ? NextResponse.json(q) : err(q.error)
      }

      case 'link_check': {
        if (!isUuid(body.bookingId)) return err('預約編號無效')
        const out = await refreshCsPaymentLink({ bookingId: body.bookingId, hostname: url.hostname, adminEmail, caseId })
        if (!out) return err('找不到這張預約的全託管付款單', 404)
        await audit('cs_payment_link_checked', body.bookingId, { outcome: out.outcome })
        return NextResponse.json(out)
      }

      case 'link_email': {
        if (!isUuid(body.userId)) return err('請先選擇會員')
        const link = s(body.url, 2000)
        if (!/^https:\/\//.test(link)) return err('連結無效')
        const out = await emailPaymentLinkToCustomer({
          userId: body.userId,
          url: link,
          humanCode: s(body.humanCode, 40),
          amount: Number(body.amount) || 0,
          summary: s(body.summary, 120),
          adminEmail,
          caseId,
        })
        return out.ok ? NextResponse.json(out) : err(out.error, 502)
      }

      case 'template_save': {
        const title = s(body.title, 80)
        const text = s(body.body, 3000)
        if (!title || !text) return err('請填寫標題和內容')
        const category = isCsCategory(body.category) ? body.category : 'other'
        const db = getLegacyServiceSupabase()
        const row = { title, body: text, category, updated_by: adminEmail, updated_at: new Date().toISOString() }
        const { error } = isUuid(body.id) ? await db.from('cs_templates').update(row).eq('id', body.id) : await db.from('cs_templates').insert(row)
        if (error) return err('儲存失敗', 500)
        await audit('cs_template_saved', undefined, { title })
        return NextResponse.json({ ok: true })
      }

      case 'template_delete': {
        if (!isUuid(body.id)) return err('範本無效')
        const { error } = await getLegacyServiceSupabase().from('cs_templates').delete().eq('id', body.id)
        if (error) return err('刪除失敗', 500)
        await audit('cs_template_deleted', undefined, { id: body.id })
        return NextResponse.json({ ok: true })
      }

      case 'template_fill': {
        const customer = isUuid(body.userId) ? await getCustomer(body.userId) : null
        const text = fillTemplate(s(body.body, 3000), {
          name: customer?.displayName ?? '',
          code: s(body.code, 40),
          link: s(body.link, 2000),
          result: s(body.result, 300),
        })
        return NextResponse.json({ text })
      }

      case 'spark_ask': {
        const prompt = s(body.prompt, 800)
        if (prompt.length < 3) return err('請輸入問題')
        if (!(await rateLimit('cs_spark', `user:${admin.id}`, 10, 60))) return err('太頻密，請稍後再試', 429)
        const out = await sparkAsk(prompt)
        await audit('cs_spark_ask', undefined, { steps: out.steps.map((x) => x.tool), ok: !!out.text })
        return out.text ? NextResponse.json({ text: out.text, steps: out.steps }) : err(out.error ?? 'Spark 沒有回應', 502)
      }

      case 'spark_diagnose':
      case 'spark_reply': {
        if (!caseId) return err('請先建立工單')
        if (!(await rateLimit('cs_spark', `user:${admin.id}`, 10, 60))) return err('太頻密，請稍後再試', 429)
        const found = await getCase(caseId)
        if (!found) return err('找不到工單', 404)
        const extra = s(body.extra, 600)
        const memberCode = found.customer?.memberCode ?? null
        if (action === 'spark_diagnose') {
          const out = await sparkDiagnose(found.case, found.notes, memberCode, extra)
          if (out.text) await addCaseNote(caseId, 'Spark', 'spark', out.text)
          await audit('cs_spark_diagnose', caseId, { steps: out.steps.map((x) => x.tool), ok: !!out.text })
          return out.text ? NextResponse.json({ text: out.text, steps: out.steps }) : err(out.error ?? 'Spark 沒有回應', 502)
        }
        const out = await sparkDraftReply(found.case, found.notes, memberCode, extra)
        await audit('cs_spark_reply', caseId, { steps: out.steps.map((x) => x.tool), ok: !!out.text })
        if (!out.text) return err(out.error ?? 'Spark 沒有回應', 502)
        const text = fillTemplate(out.text, { name: found.customer?.displayName ?? '' })
        return NextResponse.json({ text, steps: out.steps })
      }

      default:
        return err('Unknown action')
    }
  },
  { rateLimit: { bucket: 'admin_cs', max: 90, windowSeconds: 60, identifierType: 'user' } },
)
