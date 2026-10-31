/**
 * Spark's action layer — the ONLY way Spark changes the database.
 *
 * Flow:  propose → (admin reads the card) → confirm → executed → undo → redo
 *
 *  • The model can only call `proposeAction`. That validates, resolves member codes to ids on the
 *    server (the model never sees ids), applies the hard limits in `limits.ts` and stores a
 *    `pending` row. Nothing is changed yet.
 *  • `confirmAction` is the only code path that runs a change, and only for the admin who
 *    asked, only while the proposal is `pending` and unexpired.
 *  • Every change reuses the audited RPCs / write paths the rest of /admin uses, and records
 *    `audit_log` as well, so Spark never makes a change the normal pages could not.
 *  • `undoAction` reverses an executed change where that is possible; `redoAction` applies an
 *    undone one again (re-validated against today's data).
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { writeAdminAudit } from '@/lib/admin/audit'
import { adminCancelWithCredit } from '@/lib/admin/cancelWithCredit'
import type { Json } from '@/lib/supabase/database.types'
import { normalizePromoCodeInput } from '@/lib/admin/promo-code-rules'
import { SPARK_LIMITS, TIERS, TIER_LABEL, hkDayStartIso, type Tier } from './limits'
import { createAndNotifyCase, validateCaseInput } from '@/lib/cases/service'
import { SCENARIOS, isCaseScenario } from '@/lib/cases/scenarios'

export type ActionKind =
  | 'adjust_credit'
  | 'adjust_points'
  | 'set_tier'
  | 'set_blacklist'
  | 'send_message'
  | 'cancel_booking'
  | 'set_promo_status'
  | 'set_promo_expiry'
  | 'create_promo'
  | 'create_violation_case'

export type ActionStatus = 'pending' | 'executed' | 'rejected' | 'expired' | 'failed' | 'undone'
export type Risk = 'normal' | 'high'
export type PreviewLine = { label: string; value: string; tone?: 'plus' | 'minus' | 'warn' }

export type ActionCtx = {
  adminId: string
  adminEmail: string
  chatId: string | null
  messageId: string | null
}

type Args = Record<string, unknown>
type Rec = Record<string, unknown>
type Fail = { error: string }

type Prepared = { summary: string; risk: Risk; preview: PreviewLine[]; params: Rec }
type Executed = { result: Rec; undo: Rec | null }

type Def = {
  label: string
  undoable: boolean
  prepare: (args: Args) => Promise<Prepared | Fail>
  execute: (params: Rec, ctx: ActionCtx, actionId: string, undoData: Rec | null) => Promise<Executed | Fail>
  undo: (params: Rec, undoData: Rec | null, ctx: ActionCtx, actionId: string) => Promise<Fail | null>
}

export type SparkActionRow = {
  id: string
  chat_id: string | null
  message_id: string | null
  admin_user_id: string
  admin_email: string
  kind: ActionKind
  summary: string
  risk: Risk
  params: Rec
  preview: PreviewLine[]
  status: ActionStatus
  result: Rec | null
  undo_data: Rec | null
  error: string | null
  created_at: string
  expires_at: string
  decided_at: string | null
  executed_at: string | null
  undone_at: string | null
  redo_count: number
}

/** What the browser receives — no user ids, no raw params. */
export type SparkActionView = {
  id: string
  kind: ActionKind
  label: string
  summary: string
  risk: Risk
  preview: PreviewLine[]
  status: ActionStatus
  error: string | null
  createdAt: string
  expiresAt: string
  executedAt: string | null
  undoneAt: string | null
  canUndo: boolean
  canRedo: boolean
  adminEmail: string
}

// ── small helpers ────────────────────────────────────────────────────────────────────────────
const isFail = (v: unknown): v is Fail => typeof v === 'object' && v !== null && 'error' in v
const asRec = (v: unknown): Rec => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : {})
const toStr = (v: unknown, max = 500): string => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '')
const toInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isInteger(n) ? n : null
}
const hkd = (n: number): string => `HK$${n.toLocaleString('en-HK')}`
const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-HK')}`
const shortId = (id: string): string => id.slice(0, 8)

type MemberRow = { id: string; code: string; tier: string; points: number; credits: number; blacklisted: boolean }

async function findMember(code: string): Promise<MemberRow | Fail> {
  const c = toStr(code, 80).toUpperCase()
  if (!c) return { error: '請提供會員編號' }
  const { data, error } = await getLegacyServiceSupabase()
    .from('users')
    .select('id, member_code, tier, points, credits, is_blacklisted')
    .eq('member_code', c)
    .maybeSingle()
  if (error) return { error: '查詢會員失敗' }
  if (!data) return { error: `找不到會員 ${c}` }
  const r = asRec(data)
  return {
    id: String(r.id),
    code: String(r.member_code ?? c),
    tier: String(r.tier ?? 'amateur'),
    points: Number(r.points ?? 0),
    credits: Number(r.credits ?? 0),
    blacklisted: r.is_blacklisted === true,
  }
}

async function memberById(id: string): Promise<MemberRow | Fail> {
  const { data, error } = await getLegacyServiceSupabase()
    .from('users')
    .select('id, member_code, tier, points, credits, is_blacklisted')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) return { error: '找不到會員' }
  const r = asRec(data)
  return {
    id: String(r.id),
    code: String(r.member_code ?? ''),
    tier: String(r.tier ?? 'amateur'),
    points: Number(r.points ?? 0),
    credits: Number(r.credits ?? 0),
    blacklisted: r.is_blacklisted === true,
  }
}

type RpcOut = { success?: boolean; code?: string; balance?: number } | null
const asRpc = (v: unknown): RpcOut => (typeof v === 'object' && v !== null ? (v as RpcOut) : null)

async function creditMovedToday(adminId: string): Promise<number> {
  const { data } = await getLegacyServiceSupabase()
    .from('admin_spark_actions')
    .select('params')
    .eq('admin_user_id', adminId)
    .eq('kind', 'adjust_credit')
    .eq('status', 'executed')
    .gte('executed_at', hkDayStartIso())
  let sum = 0
  for (const row of (data ?? []) as { params: unknown }[]) sum += Math.abs(toInt(asRec(row.params).amount) ?? 0)
  return sum
}

// ── definitions ──────────────────────────────────────────────────────────────────────────────
const DEFS: Record<ActionKind, Def> = {
  adjust_credit: {
    label: '調整錢包額度',
    undoable: true,
    async prepare(a) {
      const amount = toInt(a.amount)
      const reason = toStr(a.reason, 200)
      if (amount === null || amount === 0) return { error: '金額必須是非零整數（加 credit 用正數，扣除用負數）' }
      if (Math.abs(amount) > SPARK_LIMITS.maxCreditPerAction) return { error: `單次最多 ${hkd(SPARK_LIMITS.maxCreditPerAction)}` }
      if (reason.length < 5) return { error: '原因至少要有 5 個字' }
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m
      const after = m.credits + amount
      if (after < 0) return { error: `${m.code} 的錢包只有 ${hkd(m.credits)}，不能扣 ${hkd(-amount)}` }
      return {
        summary: `${amount > 0 ? '加' : '扣'} ${hkd(Math.abs(amount))} 錢包額度（${m.code}）`,
        risk: Math.abs(amount) >= SPARK_LIMITS.highRiskCredit ? 'high' : 'normal',
        preview: [
          { label: '會員', value: m.code },
          { label: '變動', value: `${amount > 0 ? '+' : '−'}${hkd(Math.abs(amount))}`, tone: amount > 0 ? 'plus' : 'minus' },
          { label: '錢包', value: `${hkd(m.credits)} → ${hkd(after)}` },
          { label: '原因', value: reason },
        ],
        params: { userId: m.id, memberCode: m.code, amount, reason },
      }
    },
    async execute(p, ctx) {
      const amount = toInt(p.amount) ?? 0
      const used = await creditMovedToday(ctx.adminId)
      if (used + Math.abs(amount) > SPARK_LIMITS.maxCreditPerDay) {
        return { error: `今日經 Spark 調整的錢包額度已達上限（${hkd(SPARK_LIMITS.maxCreditPerDay)}），已用 ${hkd(used)}` }
      }
      const { data, error } = await getLegacyServiceSupabase().rpc('admin_adjust_credit', {
        p_user_id: String(p.userId),
        p_amount: amount,
        p_note: `Spark：${toStr(p.reason, 200)}`,
        p_admin_id: ctx.adminId,
      })
      const rpc = asRpc(data)
      if (error || !rpc || rpc.success !== true) return { error: `錢包額度調整失敗（${rpc?.code ?? error?.message ?? 'unknown'}）` }
      return { result: { balance: rpc.balance ?? null }, undo: { amount: -amount } }
    },
    async undo(p, u, ctx, id) {
      const back = toInt(asRec(u).amount)
      if (back === null) return { error: '沒有可還原的資料' }
      const { data, error } = await getLegacyServiceSupabase().rpc('admin_adjust_credit', {
        p_user_id: String(p.userId),
        p_amount: back,
        p_note: `Spark 還原操作 ${shortId(id)}`,
        p_admin_id: ctx.adminId,
      })
      const rpc = asRpc(data)
      if (error || !rpc || rpc.success !== true) return { error: `還原失敗（${rpc?.code ?? error?.message ?? 'unknown'}）。錢包現時餘額可能已不足。` }
      return null
    },
  },

  adjust_points: {
    label: '調整積分',
    undoable: true,
    async prepare(a) {
      const delta = toInt(a.delta)
      const reason = toStr(a.reason, 200)
      if (delta === null || delta === 0) return { error: '積分變動必須是非零整數' }
      if (Math.abs(delta) > SPARK_LIMITS.maxPointsPerAction) return { error: `單次最多 ${SPARK_LIMITS.maxPointsPerAction} 積分` }
      if (reason.length < 5) return { error: '原因至少要有 5 個字' }
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m
      if (m.points + delta < 0) return { error: `${m.code} 只有 ${m.points} 積分，不能扣 ${-delta}` }
      return {
        summary: `${delta > 0 ? '加' : '扣'} ${Math.abs(delta)} 積分（${m.code}）`,
        risk: 'normal',
        preview: [
          { label: '會員', value: m.code },
          { label: '變動', value: `${signed(delta)} 積分`, tone: delta > 0 ? 'plus' : 'minus' },
          { label: '積分', value: `${m.points} → ${m.points + delta}` },
          { label: '原因', value: reason },
        ],
        params: { userId: m.id, memberCode: m.code, delta, reason },
      }
    },
    async execute(p, ctx) {
      const delta = toInt(p.delta) ?? 0
      const { data, error } = await getLegacyServiceSupabase().rpc('admin_adjust_points', {
        p_user_id: String(p.userId),
        p_delta: delta,
        p_note: `Spark：${toStr(p.reason, 200)}`,
        p_admin_id: ctx.adminId,
      })
      const rpc = asRpc(data)
      if (error || !rpc || rpc.success !== true) return { error: `積分調整失敗（${rpc?.code ?? error?.message ?? 'unknown'}）` }
      return { result: { balance: rpc.balance ?? null }, undo: { delta: -delta } }
    },
    async undo(p, u, ctx, id) {
      const back = toInt(asRec(u).delta)
      if (back === null) return { error: '沒有可還原的資料' }
      const { data, error } = await getLegacyServiceSupabase().rpc('admin_adjust_points', {
        p_user_id: String(p.userId),
        p_delta: back,
        p_note: `Spark 還原操作 ${shortId(id)}`,
        p_admin_id: ctx.adminId,
      })
      const rpc = asRpc(data)
      if (error || !rpc || rpc.success !== true) return { error: `還原失敗（${rpc?.code ?? error?.message ?? 'unknown'}）` }
      return null
    },
  },

  set_tier: {
    label: '更改會員等級',
    undoable: true,
    async prepare(a) {
      const tier = TIERS.find((t) => t === a.tier)
      const reason = toStr(a.reason, 200)
      if (!tier) return { error: '等級必須是 amateur、century 或 maximum' }
      if (reason.length < 5) return { error: '原因至少要有 5 個字' }
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m
      if (m.tier === tier) return { error: `${m.code} 已經是${TIER_LABEL[tier]}` }
      const label = (t: string): string => (TIERS.some((x) => x === t) ? TIER_LABEL[t as Tier] : t)
      return {
        summary: `${m.code} 改為${TIER_LABEL[tier]}`,
        risk: 'normal',
        preview: [
          { label: '會員', value: m.code },
          { label: '等級', value: `${label(m.tier)} → ${TIER_LABEL[tier]}` },
          { label: '原因', value: reason },
        ],
        params: { userId: m.id, memberCode: m.code, tier, reason },
      }
    },
    async execute(p, ctx) {
      const m = await memberById(String(p.userId))
      if (isFail(m)) return m
      const { error } = await getLegacyServiceSupabase().from('users').update({ tier: p.tier }).eq('id', String(p.userId))
      if (error) return { error: '更改等級失敗' }
      await writeAdminAudit({
        adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'member_set_tier', targetTable: 'users',
        targetId: String(p.userId), beforeValue: { tier: m.tier, via: 'spark' }, afterValue: { tier: String(p.tier), reason: toStr(p.reason), via: 'spark' },
      })
      return { result: { tier: p.tier as Json }, undo: { tier: m.tier } }
    },
    async undo(p, u) {
      const tier = toStr(asRec(u).tier, 20)
      if (!tier) return { error: '沒有可還原的資料' }
      const { error } = await getLegacyServiceSupabase().from('users').update({ tier }).eq('id', String(p.userId))
      return error ? { error: '還原失敗' } : null
    },
  },

  set_blacklist: {
    label: '黑名單',
    undoable: true,
    async prepare(a) {
      const reason = toStr(a.reason, 200)
      if (typeof a.blacklisted !== 'boolean') return { error: '請指明要加入還是移出黑名單' }
      if (reason.length < 5) return { error: '原因至少要有 5 個字' }
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m
      if (m.blacklisted === a.blacklisted) return { error: `${m.code} 已經${a.blacklisted ? '在' : '不在'}黑名單` }
      return {
        summary: `將 ${m.code} ${a.blacklisted ? '加入黑名單' : '移出黑名單'}`,
        risk: a.blacklisted ? 'high' : 'normal',
        preview: [
          { label: '會員', value: m.code },
          { label: '狀態', value: a.blacklisted ? '正常 → 黑名單（不能再預約）' : '黑名單 → 正常', tone: a.blacklisted ? 'warn' : undefined },
          { label: '原因', value: reason },
        ],
        params: { userId: m.id, memberCode: m.code, blacklisted: a.blacklisted, reason },
      }
    },
    async execute(p, ctx) {
      const m = await memberById(String(p.userId))
      if (isFail(m)) return m
      const { error } = await getLegacyServiceSupabase().from('users').update({ is_blacklisted: p.blacklisted === true }).eq('id', String(p.userId))
      if (error) return { error: '更新黑名單失敗' }
      await writeAdminAudit({
        adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: p.blacklisted === true ? 'member_blacklist' : 'member_unblacklist',
        targetTable: 'users', targetId: String(p.userId), beforeValue: { is_blacklisted: m.blacklisted, via: 'spark' },
        afterValue: { is_blacklisted: p.blacklisted === true, reason: toStr(p.reason), via: 'spark' },
      })
      return { result: { blacklisted: p.blacklisted === true }, undo: { blacklisted: m.blacklisted } }
    },
    async undo(p, u) {
      const { error } = await getLegacyServiceSupabase().from('users').update({ is_blacklisted: asRec(u).blacklisted === true }).eq('id', String(p.userId))
      return error ? { error: '還原失敗' } : null
    },
  },

  send_message: {
    label: '發送訊息給會員',
    undoable: true,
    async prepare(a) {
      const title = toStr(a.title, 80)
      const message = toStr(a.message, 600)
      if (!title || !message) return { error: '請提供標題和內容' }
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m
      return {
        summary: `發送訊息給 ${m.code}`,
        risk: 'normal',
        preview: [
          { label: '會員', value: m.code },
          { label: '標題', value: title },
          { label: '內容', value: message },
        ],
        params: { userId: m.id, memberCode: m.code, title, message },
      }
    },
    async execute(p, ctx) {
      const { data, error } = await getLegacyServiceSupabase()
        .from('admin_notifications')
        .insert({ user_id: String(p.userId), title: String(p.title), message: String(p.message), type: 'system', read: false })
        .select('id')
        .single()
      if (error || !data) return { error: '發送失敗' }
      const nid = String(asRec(data).id)
      await writeAdminAudit({
        adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'member_message', targetTable: 'admin_notifications',
        targetId: String(p.userId), beforeValue: null, afterValue: { title: String(p.title), via: 'spark' },
      })
      return { result: { notificationId: nid }, undo: { notificationId: nid } }
    },
    async undo(_p, u) {
      const nid = toStr(asRec(u).notificationId, 80)
      if (!nid) return { error: '沒有可還原的資料' }
      const { error } = await getLegacyServiceSupabase().from('admin_notifications').delete().eq('id', nid)
      return error ? { error: '收回訊息失敗' } : null
    },
  },

  cancel_booking: {
    label: '取消預約',
    undoable: false,
    async prepare(a) {
      const ref = toStr(a.bookingCode, 80)
      const reason = toStr(a.reason, 200)
      const whatsappRef = toStr(a.whatsappRef, 80)
      const credit = toInt(a.creditAmount ?? 0)
      if (!ref) return { error: '請提供預約編號' }
      if (reason.length < 5) return { error: '取消原因至少要有 5 個字' }
      if (whatsappRef.length < 3) return { error: '需要 WhatsApp／客戶聯絡參考（至少 3 個字）才可取消預約' }
      if (credit === null || credit < 0 || credit > SPARK_LIMITS.maxCancelCredit) return { error: `退回 credit 必須是 0 至 ${SPARK_LIMITS.maxCancelCredit}` }
      const svc = getLegacyServiceSupabase()
      let row: Rec | null = null
      for (const col of ['human_code', 'booking_reference']) {
        const { data } = await svc.from('bookings').select('id, human_code, booking_reference, date, start_time, end_time, table_number, total_price, status, is_test').eq(col, ref).maybeSingle()
        if (data) { row = asRec(data); break }
      }
      if (!row) return { error: `找不到預約 ${ref}` }
      if (row.status !== 'confirmed') return { error: `這張預約狀態是 ${String(row.status)}，只有「已確認」的預約可以取消` }
      const code = String(row.human_code ?? row.booking_reference ?? ref)
      const price = Number(row.total_price ?? 0)
      if (credit > price) return { error: `退回 credit（${hkd(credit)}）不能多過預約金額（${hkd(price)}）` }
      return {
        summary: `取消預約 ${code}${credit > 0 ? `，退回 ${hkd(credit)}` : ''}`,
        risk: 'high',
        preview: [
          { label: '預約', value: code },
          { label: '日期', value: `${String(row.date)} ${String(row.start_time ?? '').slice(0, 5)}–${String(row.end_time ?? '').slice(0, 5)}（房 ${String(row.table_number ?? '?')}）` },
          { label: '預約金額', value: hkd(price) },
          { label: '退回錢包', value: credit > 0 ? hkd(credit) : '不退款', tone: credit > 0 ? 'plus' : undefined },
          { label: '原因', value: reason },
          { label: '聯絡參考', value: whatsappRef },
          { label: '注意', value: '取消後無法還原；會員會收到通知', tone: 'warn' },
        ],
        params: { bookingId: String(row.id), bookingCode: code, reason, whatsappRef, creditAmount: credit },
      }
    },
    async execute(p, ctx) {
      const credit = toInt(p.creditAmount) ?? 0
      const out = await adminCancelWithCredit({
        bookingId: String(p.bookingId),
        adminId: ctx.adminId,
        reason: String(p.reason),
        whatsappRef: String(p.whatsappRef),
        creditAmount: credit,
        noticeTitle: '你的預約已被取消',
        noticeMessage: `你的預約 ${String(p.bookingCode)} 已由店方取消。${credit > 0 ? `已退回 HK$${credit} 到你的錢包。` : ''}如有疑問請聯絡我們。`,
      })
      if (!out.ok) return { error: out.error }
      return { result: { credit: out.credit, pointsReversed: out.pointsReversed }, undo: null }
    },
    async undo() {
      return { error: '取消預約無法還原' }
    },
  },

  set_promo_status: {
    label: '優惠碼狀態',
    undoable: true,
    async prepare(a) {
      const code = toStr(a.code, 40).toUpperCase()
      const status = ['active', 'disabled'].find((s) => s === a.status)
      if (!code) return { error: '請提供優惠碼' }
      if (!status) return { error: '狀態必須是 active（啟用）或 disabled（停用）' }
      const { data } = await getLegacyServiceSupabase().from('promotion_codes').select('id, code, status, valid_until').eq('code', code).maybeSingle()
      if (!data) return { error: `找不到優惠碼 ${code}` }
      const r = asRec(data)
      if (r.status === status) return { error: `${code} 已經是${status === 'active' ? '啟用' : '停用'}` }
      if (status === 'active' && typeof r.valid_until === 'string' && new Date(r.valid_until).getTime() < Date.now()) {
        return { error: `${code} 已過期（${r.valid_until.slice(0, 10)}），請先延長有效期` }
      }
      return {
        summary: `${status === 'active' ? '啟用' : '停用'}優惠碼 ${code}`,
        risk: 'normal',
        preview: [
          { label: '優惠碼', value: code },
          { label: '狀態', value: `${String(r.status)} → ${status}`, tone: status === 'disabled' ? 'warn' : 'plus' },
        ],
        params: { promoId: String(r.id), code, status },
      }
    },
    async execute(p, ctx) {
      const svc = getLegacyServiceSupabase()
      const { data: before } = await svc.from('promotion_codes').select('status').eq('id', String(p.promoId)).maybeSingle()
      if (!before) return { error: '找不到優惠碼' }
      const status = String(p.status)
      const prev = String(asRec(before).status)
      const { error } = await svc.from('promotion_codes').update({ status, is_active: status === 'active' }).eq('id', String(p.promoId))
      if (error) return { error: '更新優惠碼失敗' }
      await writeAdminAudit({
        adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'promo_code_updated', targetTable: 'promotion_codes',
        targetId: String(p.promoId), beforeValue: { status: prev, via: 'spark' }, afterValue: { status, via: 'spark' },
      })
      return { result: { status }, undo: { status: prev } }
    },
    async undo(p, u) {
      const status = toStr(asRec(u).status, 20)
      if (!['draft', 'active', 'disabled'].includes(status)) return { error: '沒有可還原的資料' }
      const { error } = await getLegacyServiceSupabase().from('promotion_codes').update({ status, is_active: status === 'active' }).eq('id', String(p.promoId))
      return error ? { error: '還原失敗' } : null
    },
  },

  set_promo_expiry: {
    label: '優惠碼有效期',
    undoable: true,
    async prepare(a) {
      const code = toStr(a.code, 40).toUpperCase()
      const until = toStr(a.validUntil, 10)
      if (!code) return { error: '請提供優惠碼' }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(new Date(`${until}T00:00:00+08:00`).getTime())) return { error: '日期格式必須是 YYYY-MM-DD' }
      if (new Date(`${until}T23:59:59+08:00`).getTime() < Date.now()) return { error: '新的有效期不能是過去的日期' }
      const { data } = await getLegacyServiceSupabase().from('promotion_codes').select('id, code, valid_until').eq('code', code).maybeSingle()
      if (!data) return { error: `找不到優惠碼 ${code}` }
      const r = asRec(data)
      const prev = typeof r.valid_until === 'string' ? r.valid_until.slice(0, 10) : '無限期'
      return {
        summary: `${code} 有效期改為 ${until}`,
        risk: 'normal',
        preview: [
          { label: '優惠碼', value: code },
          { label: '有效至', value: `${prev} → ${until}` },
        ],
        params: { promoId: String(r.id), code, validUntil: until },
      }
    },
    async execute(p, ctx) {
      const svc = getLegacyServiceSupabase()
      const { data: before } = await svc.from('promotion_codes').select('valid_until').eq('id', String(p.promoId)).maybeSingle()
      if (!before) return { error: '找不到優惠碼' }
      const prev = asRec(before).valid_until
      const next = new Date(`${String(p.validUntil)}T23:59:59+08:00`).toISOString()
      const { error } = await svc.from('promotion_codes').update({ valid_until: next }).eq('id', String(p.promoId))
      if (error) return { error: '更新有效期失敗' }
      await writeAdminAudit({
        adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'promo_code_updated', targetTable: 'promotion_codes',
        targetId: String(p.promoId), beforeValue: { valid_until: typeof prev === 'string' ? prev : null, via: 'spark' }, afterValue: { valid_until: next, via: 'spark' },
      })
      return { result: { validUntil: next }, undo: { validUntil: typeof prev === 'string' ? prev : null } }
    },
    async undo(p, u) {
      const prev = asRec(u).validUntil
      const { error } = await getLegacyServiceSupabase().from('promotion_codes').update({ valid_until: typeof prev === 'string' ? prev : null }).eq('id', String(p.promoId))
      return error ? { error: '還原失敗' } : null
    },
  },

  create_promo: {
    label: '建立優惠碼',
    undoable: true,
    async prepare(a) {
      const code = toStr(a.code, 20).toUpperCase()
      const name = toStr(a.name, 60)
      const type = a.discountType === 'percentage' || a.discountType === 'fixed_amount' ? a.discountType : null
      const value = toInt(a.discountValue)
      const until = toStr(a.validUntil, 10)
      if (!type) return { error: '折扣類型必須是 percentage（百分比）或 fixed_amount（固定金額）' }
      if (value === null || value < 1) return { error: '折扣數值必須是大於 0 的整數' }
      if (type === 'percentage' && value > SPARK_LIMITS.maxPromoPercent) return { error: `經 Spark 建立的百分比折扣最多 ${SPARK_LIMITS.maxPromoPercent}%` }
      if (type === 'fixed_amount' && value > SPARK_LIMITS.maxPromoFixed) return { error: `經 Spark 建立的固定折扣最多 ${hkd(SPARK_LIMITS.maxPromoFixed)}` }
      if (!name) return { error: '請提供優惠碼名稱' }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: '結束日期格式必須是 YYYY-MM-DD' }
      const untilMs = new Date(`${until}T23:59:59+08:00`).getTime()
      if (Number.isNaN(untilMs) || untilMs < Date.now()) return { error: '結束日期不能是過去' }
      if (untilMs > Date.now() + SPARK_LIMITS.maxPromoDays * 86_400_000) return { error: `有效期最長 ${SPARK_LIMITS.maxPromoDays} 日` }
      const audience = ['all', 'new_users'].find((x) => x === a.audience) ?? 'all'
      const maxUses = a.maxUses === undefined || a.maxUses === null ? null : toInt(a.maxUses)
      const perUser = a.perUserLimit === undefined || a.perUserLimit === null ? 1 : toInt(a.perUserLimit)
      const minCart = a.minCartAmount === undefined || a.minCartAmount === null ? null : toInt(a.minCartAmount)
      const norm = normalizePromoCodeInput({
        code, name, discountType: type, discountValue: value, status: 'active', audience, audienceThreshold: null,
        maxUses, perUserLimit: perUser, minCartAmount: minCart, maxDiscount: null,
        validFrom: new Date().toISOString(), validUntil: new Date(untilMs).toISOString(),
        stackableWithCredits: false, stackableWithOtherCodes: false, weekdays: null, timeWindows: null,
      })
      if (!norm.ok) return { error: norm.error }
      const { data: dup } = await getLegacyServiceSupabase().from('promotion_codes').select('id').eq('code', norm.value.code).maybeSingle()
      if (dup) return { error: `優惠碼 ${norm.value.code} 已存在（優惠碼不能刪除，可改用其他編號）` }
      const v = norm.value
      return {
        summary: `建立優惠碼 ${v.code}（${type === 'percentage' ? `${value}%` : hkd(value)}）`,
        risk: 'high',
        preview: [
          { label: '優惠碼', value: v.code },
          { label: '名稱', value: v.name },
          { label: '折扣', value: type === 'percentage' ? `${value}% off` : `減 ${hkd(value)}`, tone: 'plus' },
          { label: '有效至', value: until },
          { label: '對象', value: audience === 'new_users' ? '新會員' : '所有會員' },
          { label: '次數', value: `${maxUses === null ? '不限總數' : `共 ${maxUses} 次`}・每人 ${perUser ?? '不限'} 次` },
          { label: '最低消費', value: minCart ? hkd(minCart) : '無' },
          { label: '注意', value: '確認後立即生效，客人可即時使用；優惠碼不能刪除，只能停用', tone: 'warn' },
        ],
        params: { code: v.code, name: v.name, discountType: type, discountValue: value, validUntil: until, audience, maxUses, perUserLimit: perUser, minCartAmount: minCart, validUntilIso: v.validUntil },
      }
    },
    async execute(p, ctx, _id, undoData) {
      const svc = getLegacyServiceSupabase()
      const priorId = toStr(asRec(undoData).promoId, 80)
      if (priorId) {
        // Redo: bring back the code this action created earlier.
        const { data } = await svc.from('promotion_codes').select('id, code').eq('id', priorId).maybeSingle()
        if (!data || String(asRec(data).code) !== String(p.code)) return { error: '找不到原本建立的優惠碼' }
        const { error } = await svc.from('promotion_codes').update({ status: 'active', is_active: true }).eq('id', priorId)
        if (error) return { error: '重新啟用失敗' }
        await writeAdminAudit({ adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'promo_code_updated', targetTable: 'promotion_codes', targetId: priorId, beforeValue: { status: 'disabled', via: 'spark' }, afterValue: { status: 'active', via: 'spark' } })
        return { result: { promoId: priorId }, undo: { promoId: priorId } }
      }
      const norm = normalizePromoCodeInput({
        code: String(p.code), name: String(p.name), discountType: String(p.discountType), discountValue: p.discountValue, status: 'active',
        audience: String(p.audience), audienceThreshold: null, maxUses: p.maxUses, perUserLimit: p.perUserLimit, minCartAmount: p.minCartAmount, maxDiscount: null,
        validFrom: new Date().toISOString(), validUntil: String(p.validUntilIso), stackableWithCredits: false, stackableWithOtherCodes: false, weekdays: null, timeWindows: null,
      })
      if (!norm.ok) return { error: norm.error }
      const v = norm.value
      const { data: adminUser } = await svc.from('admin_users').select('id').eq('email', ctx.adminEmail).maybeSingle()
      const { data, error } = await svc.from('promotion_codes').insert({
        code: v.code, name: v.name || null, discount_type: v.discountType, discount_value: v.discountValue, status: 'active', is_active: true,
        audience: v.audience, audience_threshold: v.audienceThreshold, max_uses: v.maxUses, per_user_limit: v.perUserLimit, min_cart_amount: v.minCartAmount,
        max_discount: v.maxDiscount, valid_from: v.validFrom, valid_until: v.validUntil, stackable_with_credits: v.stackableWithCredits,
        stackable_with_other_codes: v.stackableWithOtherCodes, weekdays: v.weekdays, time_windows: v.timeWindows, created_by: adminUser ? asRec(adminUser).id : null,
      }).select('id').single()
      if (error || !data) return { error: error?.code === '23505' ? '此優惠碼已存在' : '建立優惠碼失敗' }
      const id = String(asRec(data).id)
      await writeAdminAudit({ adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'promo_code_created', targetTable: 'promotion_codes', targetId: id, beforeValue: null, afterValue: { code: v.code, via: 'spark' } })
      return { result: { promoId: id }, undo: { promoId: id } }
    },
    async undo(_p, u, ctx) {
      const id = toStr(asRec(u).promoId, 80)
      if (!id) return { error: '沒有可還原的資料' }
      const { error } = await getLegacyServiceSupabase().from('promotion_codes').update({ status: 'disabled', is_active: false }).eq('id', id)
      if (error) return { error: '還原失敗' }
      await writeAdminAudit({ adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action: 'promo_code_updated', targetTable: 'promotion_codes', targetId: id, beforeValue: { status: 'active', via: 'spark' }, afterValue: { status: 'disabled', via: 'spark' } })
      return null
    },
  },
  create_violation_case: {
    label: '開違規個案',
    undoable: false,
    async prepare(a) {
      if (!isCaseScenario(a.scenario)) return { error: '請指明違規情境：smoking／damage／overtime／over_capacity／pet／other' }
      const preset = SCENARIOS[a.scenario]
      const detail = toStr(a.detail, 1000)
      const evidenceNote = toStr(a.evidenceNote, 500)
      const amountRaw = a.amount === undefined || a.amount === null ? preset.defaultAmount : Number(a.amount)
      if (amountRaw === null || !Number.isFinite(amountRaw)) return { error: `${preset.label}沒有預設金額，請提供費用（HK$）；僅警告請用 0` }
      const applyBlacklist = typeof a.applyBlacklist === 'boolean' ? a.applyBlacklist : preset.applyBlacklistByDefault
      const m = await findMember(toStr(a.memberCode))
      if (isFail(m)) return m

      let bookingId: string | null = null
      const bookingCode = toStr(a.bookingCode, 80)
      if (bookingCode) {
        const { data: b } = await getLegacyServiceSupabase().from('bookings').select('id, user_id').ilike('human_code', bookingCode).maybeSingle()
        const br = asRec(b)
        if (typeof br.id !== 'string' || br.user_id !== m.id) return { error: `找不到 ${m.code} 的預約 ${bookingCode}` }
        bookingId = br.id
      }

      const invalid = validateCaseInput({ userId: m.id, scenario: a.scenario, detail, amount: amountRaw, applyBlacklist, bookingId })
      if (invalid) return { error: invalid }

      const warning = amountRaw === 0
      return {
        summary: `開違規個案（${preset.label}）給 ${m.code}${warning ? '，僅警告' : `，費用 ${hkd(amountRaw)}`}`,
        risk: 'high',
        preview: [
          { label: '會員', value: m.code },
          { label: '情境', value: `${preset.label}（${preset.clause}）` },
          { label: '費用', value: warning ? '僅警告，毋須繳費' : hkd(amountRaw), tone: warning ? undefined : 'minus' },
          { label: '事實', value: detail },
          { label: '通知', value: warning ? 'Email + 收件箱' : `Email + 收件箱 + KPay 付款連結（${preset.dueDays} 日內繳付）` },
          { label: '黑名單', value: applyBlacklist ? (m.blacklisted ? '已在黑名單' : '會員會被加入黑名單（不能再預約）') : '不加入', tone: applyBlacklist && !m.blacklisted ? 'warn' : undefined },
          ...(bookingCode ? [{ label: '預約', value: bookingCode }] : []),
          ...(evidenceNote ? [{ label: '內部證據', value: evidenceNote }] : []),
        ],
        params: { userId: m.id, memberCode: m.code, scenario: a.scenario, detail, evidenceNote, amount: amountRaw, applyBlacklist, bookingId, bookingCode },
      }
    },
    async execute(p, ctx) {
      if (!isCaseScenario(p.scenario)) return { error: '違規情境無效' }
      const r = await createAndNotifyCase(
        {
          userId: String(p.userId),
          bookingId: typeof p.bookingId === 'string' ? p.bookingId : null,
          scenario: p.scenario,
          detail: toStr(p.detail, 1000),
          evidenceNote: toStr(p.evidenceNote, 500) || undefined,
          amount: Number(p.amount),
          applyBlacklist: p.applyBlacklist === true,
        },
        { adminId: ctx.adminId, adminEmail: ctx.adminEmail },
      )
      if (!r.ok) return { error: r.error }
      return { result: { caseId: r.value.case.id, caseNo: r.value.case.case_no, blacklisted: r.value.blacklisted }, undo: null }
    },
    async undo() {
      return { error: '個案通知已發出，不能還原。請到後台「違規個案」頁取消或豁免。' }
    },
  },
}

export const ACTION_KINDS = Object.keys(DEFS) as ActionKind[]
export const isActionKind = (v: unknown): v is ActionKind => typeof v === 'string' && v in DEFS

// ── persistence + state machine ──────────────────────────────────────────────────────────────
const COLS = '*'

function toView(row: SparkActionRow): SparkActionView {
  const def = DEFS[row.kind]
  const expired = row.status === 'pending' && new Date(row.expires_at).getTime() < Date.now()
  return {
    id: row.id,
    kind: row.kind,
    label: def?.label ?? row.kind,
    summary: row.summary,
    risk: row.risk,
    preview: Array.isArray(row.preview) ? row.preview : [],
    status: expired ? 'expired' : row.status,
    error: row.error,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    executedAt: row.executed_at,
    undoneAt: row.undone_at,
    canUndo: row.status === 'executed' && !!def?.undoable && row.undo_data !== null,
    canRedo: row.status === 'undone' && !!def?.undoable,
    adminEmail: row.admin_email,
  }
}

export const actionView = toView

async function loadRow(id: string): Promise<SparkActionRow | null> {
  const { data } = await getLegacyServiceSupabase().from('admin_spark_actions').select(COLS).eq('id', id).maybeSingle()
  return (data as SparkActionRow | null) ?? null
}

export async function getActionView(id: string): Promise<SparkActionView | null> {
  const r = await loadRow(id)
  return r ? toView(r) : null
}

export async function proposeAction(kind: string, args: Args, ctx: ActionCtx): Promise<{ ok: true; action: SparkActionView } | { ok: false; error: string }> {
  if (!isActionKind(kind)) return { ok: false, error: `不支援的操作：${kind}` }
  const svc = getLegacyServiceSupabase()

  const since = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await svc.from('admin_spark_actions').select('id', { count: 'exact', head: true }).eq('admin_user_id', ctx.adminId).gte('created_at', since)
  if ((count ?? 0) >= SPARK_LIMITS.maxProposalsPerHour) return { ok: false, error: '一小時內提出的操作太多，請稍後再試' }

  const prepared = await DEFS[kind].prepare(args)
  if (isFail(prepared)) return { ok: false, error: prepared.error }

  // Same proposal already waiting in this chat → hand back that one instead of stacking duplicates.
  if (ctx.chatId) {
    const { data: dup } = await svc.from('admin_spark_actions').select(COLS).eq('chat_id', ctx.chatId).eq('kind', kind).eq('status', 'pending').gt('expires_at', new Date().toISOString())
    for (const d of (dup ?? []) as SparkActionRow[]) {
      if (JSON.stringify(d.params) === JSON.stringify(prepared.params)) return { ok: true, action: toView(d) }
    }
  }

  const { data, error } = await svc
    .from('admin_spark_actions')
    .insert({
      chat_id: ctx.chatId,
      message_id: ctx.messageId,
      admin_user_id: ctx.adminId,
      admin_email: ctx.adminEmail,
      kind,
      summary: prepared.summary,
      risk: prepared.risk,
      params: prepared.params,
      preview: prepared.preview,
      expires_at: new Date(Date.now() + SPARK_LIMITS.proposalTtlMinutes * 60_000).toISOString(),
    })
    .select(COLS)
    .single()
  if (error || !data) return { ok: false, error: '無法建立操作，請再試' }
  return { ok: true, action: toView(data as SparkActionRow) }
}

type Outcome = { ok: true; action: SparkActionView } | { ok: false; error: string; status: number }
const out404: Outcome = { ok: false, error: '找不到這個操作', status: 404 }

async function owned(id: string, ctx: ActionCtx): Promise<SparkActionRow | Outcome> {
  const row = await loadRow(id)
  if (!row) return out404
  if (row.admin_user_id !== ctx.adminId) return { ok: false, error: '只有提出這個操作的管理員可以處理它', status: 403 }
  return row
}
const isOutcome = (v: SparkActionRow | Outcome): v is Outcome => 'ok' in v

async function audit(ctx: ActionCtx, row: SparkActionRow, action: string, extra: Rec): Promise<void> {
  try {
    await writeAdminAudit({
      adminUserId: ctx.adminId, adminEmail: ctx.adminEmail, action, targetTable: 'admin_spark_actions', targetId: row.id,
      beforeValue: null, afterValue: { kind: row.kind, summary: row.summary, ...extra } as Json,
    })
  } catch (e) {
    console.error('[spark] audit failed', e)
  }
}

async function runExecute(row: SparkActionRow, ctx: ActionCtx, fromStatus: 'pending' | 'undone'): Promise<Outcome> {
  const svc = getLegacyServiceSupabase()
  const now = new Date().toISOString()
  // Claim: only one caller can move the row out of its waiting state.
  const claim = await svc
    .from('admin_spark_actions')
    .update({ status: 'executed', decided_at: now, executed_at: now, undone_at: null, error: null, ...(fromStatus === 'undone' ? { redo_count: row.redo_count + 1 } : {}) })
    .eq('id', row.id)
    .eq('status', fromStatus)
    .select(COLS)
    .maybeSingle()
  if (!claim.data) return { ok: false, error: '這個操作已被處理', status: 409 }

  let res: Executed | Fail
  try {
    res = await DEFS[row.kind].execute(row.params, ctx, row.id, row.undo_data)
  } catch (e) {
    console.error('[spark] execute threw', e)
    res = { error: '執行時發生錯誤' }
  }
  if (isFail(res)) {
    await svc.from('admin_spark_actions').update({ status: fromStatus === 'pending' ? 'failed' : 'undone', error: res.error }).eq('id', row.id)
    await audit(ctx, row, 'spark_action_failed', { error: res.error })
    return { ok: false, error: res.error, status: 422 }
  }
  const { data } = await svc.from('admin_spark_actions').update({ result: res.result, undo_data: res.undo }).eq('id', row.id).select(COLS).single()
  await audit(ctx, row, fromStatus === 'pending' ? 'spark_action_confirmed' : 'spark_action_redone', { result: res.result as Json })
  return { ok: true, action: toView((data ?? claim.data) as SparkActionRow) }
}

export async function confirmAction(id: string, ctx: ActionCtx): Promise<Outcome> {
  const row = await owned(id, ctx)
  if (isOutcome(row)) return row
  if (row.status !== 'pending') return { ok: false, error: '這個操作已被處理', status: 409 }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await getLegacyServiceSupabase().from('admin_spark_actions').update({ status: 'expired' }).eq('id', id).eq('status', 'pending')
    return { ok: false, error: '這個操作已過期，請重新提出', status: 410 }
  }
  return runExecute(row, ctx, 'pending')
}

export async function rejectAction(id: string, ctx: ActionCtx): Promise<Outcome> {
  const row = await owned(id, ctx)
  if (isOutcome(row)) return row
  const { data } = await getLegacyServiceSupabase()
    .from('admin_spark_actions')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select(COLS)
    .maybeSingle()
  if (!data) return { ok: false, error: '這個操作已被處理', status: 409 }
  await audit(ctx, row, 'spark_action_rejected', {})
  return { ok: true, action: toView(data as SparkActionRow) }
}

export async function undoAction(id: string, ctx: ActionCtx): Promise<Outcome> {
  const row = await owned(id, ctx)
  if (isOutcome(row)) return row
  const def = DEFS[row.kind]
  if (!def.undoable) return { ok: false, error: '這類操作無法還原', status: 400 }
  const svc = getLegacyServiceSupabase()
  const claim = await svc
    .from('admin_spark_actions')
    .update({ status: 'undone', undone_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'executed')
    .select(COLS)
    .maybeSingle()
  if (!claim.data) return { ok: false, error: '這個操作現時不能還原', status: 409 }
  let fail: Fail | null
  try {
    fail = await def.undo(row.params, row.undo_data, ctx, row.id)
  } catch (e) {
    console.error('[spark] undo threw', e)
    fail = { error: '還原時發生錯誤' }
  }
  if (fail) {
    await svc.from('admin_spark_actions').update({ status: 'executed', undone_at: null, error: fail.error }).eq('id', id)
    await audit(ctx, row, 'spark_action_undo_failed', { error: fail.error })
    return { ok: false, error: fail.error, status: 422 }
  }
  await audit(ctx, row, 'spark_action_undone', {})
  return { ok: true, action: toView(claim.data as SparkActionRow) }
}

export async function redoAction(id: string, ctx: ActionCtx): Promise<Outcome> {
  const row = await owned(id, ctx)
  if (isOutcome(row)) return row
  if (!DEFS[row.kind].undoable || row.status !== 'undone') return { ok: false, error: '這個操作現時不能重做', status: 409 }
  // Re-validate against today's data (balances / state may have moved since the first run).
  const again = await DEFS[row.kind].prepare(prepareArgsFromParams(row))
  if (isFail(again)) return { ok: false, error: `重做前檢查失敗：${again.error}`, status: 422 }
  return runExecute(row, ctx, 'undone')
}

/** Rebuild the model-facing arguments from stored params so `prepare` can re-check them. */
function prepareArgsFromParams(row: SparkActionRow): Args {
  const p = row.params
  switch (row.kind) {
    case 'adjust_credit': return { memberCode: p.memberCode, amount: p.amount, reason: p.reason }
    case 'adjust_points': return { memberCode: p.memberCode, delta: p.delta, reason: p.reason }
    case 'set_tier': return { memberCode: p.memberCode, tier: p.tier, reason: p.reason }
    case 'set_blacklist': return { memberCode: p.memberCode, blacklisted: p.blacklisted, reason: p.reason }
    case 'send_message': return { memberCode: p.memberCode, title: p.title, message: p.message }
    case 'cancel_booking': return { bookingCode: p.bookingCode, reason: p.reason, whatsappRef: p.whatsappRef, creditAmount: p.creditAmount }
    case 'set_promo_status': return { code: p.code, status: p.status }
    case 'set_promo_expiry': return { code: p.code, validUntil: p.validUntil }
    case 'create_promo': return { ...p, redo: true }
    case 'create_violation_case': return { memberCode: p.memberCode, scenario: p.scenario, detail: p.detail, evidenceNote: p.evidenceNote, amount: p.amount, applyBlacklist: p.applyBlacklist, bookingCode: p.bookingCode }
  }
}

export async function listActionViews(opts: { chatId?: string; limit?: number; status?: ActionStatus }): Promise<SparkActionView[]> {
  let q = getLegacyServiceSupabase().from('admin_spark_actions').select(COLS).order('created_at', { ascending: false }).limit(Math.min(opts.limit ?? 100, 200))
  if (opts.chatId) q = q.eq('chat_id', opts.chatId)
  if (opts.status) q = q.eq('status', opts.status)
  const { data } = await q
  return ((data ?? []) as SparkActionRow[]).map(toView)
}
