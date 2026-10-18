/**
 * Single choke point for admin cancel-with-credit.
 *
 * Every caller that needs `status = 'admin_cancelled'` goes through
 * `admin_cancel_with_credit()`. The RPC is one transaction: it flips the
 * status, releases the slot, reverses booking points, optionally grants
 * wallet credit via `wallet_apply`, writes `cancellation_log` + `audit_log`,
 * and notifies the member. Writing `admin_cancelled` from anywhere else
 * skips the money and ledger side-effects — that is the bug this replaces.
 *
 * Callers must NOT write their own audit row afterwards; the RPC already does.
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export type CancelWithCreditInput = {
  bookingId: string
  adminId: string
  /** ≥ 5 characters — the RPC enforces this too. */
  reason: string
  /** WhatsApp / customer-contact reference. ≥ 3 characters. */
  whatsappRef: string
  /** HK$ wallet credit. 0 = plain cancel. */
  creditAmount: number
  noticeTitle: string
  noticeMessage: string
}

export type CancelWithCreditResult =
  | {
      ok: true
      bookingId: string
      userId: string
      credit: number
      pointsReversed: number
      balance: number | null
    }
  | { ok: false; error: string; code: string }

/** RPC error codes → the Traditional Chinese message an admin can act on. */
const CODE_MESSAGES: Record<string, string> = {
  admin_not_active: '找不到生效中的管理員帳戶',
  reason_required: '取消原因至少要有 5 個字',
  whatsapp_ref_required: '必須提供 WhatsApp / 客戶聯絡參考（至少 3 個字）',
  invalid_amount: 'Credit 金額無效',
  amount_out_of_range: 'Credit 金額超過單次上限',
  booking_not_found: '找不到預約',
  not_cancellable: '只有已確認的預約可由此取消',
  already_ended: '預約已結束，不可取消',
}

export async function adminCancelWithCredit(
  input: CancelWithCreditInput,
): Promise<CancelWithCreditResult> {
  const reason = input.reason.trim()
  const whatsappRef = input.whatsappRef.trim()

  // Fail fast with the same rules the RPC enforces, so the UI gets a
  // specific message instead of a generic RPC error.
  if (reason.length < 5) {
    return { ok: false, code: 'reason_required', error: CODE_MESSAGES.reason_required }
  }
  if (whatsappRef.length < 3) {
    return { ok: false, code: 'whatsapp_ref_required', error: CODE_MESSAGES.whatsapp_ref_required }
  }
  if (!Number.isInteger(input.creditAmount) || input.creditAmount < 0) {
    return { ok: false, code: 'invalid_amount', error: CODE_MESSAGES.invalid_amount }
  }

  const service = getLegacyServiceSupabase()
  const { data, error } = await service.rpc('admin_cancel_with_credit', {
    p_booking_id: input.bookingId,
    p_admin_id: input.adminId,
    p_reason: reason,
    p_whatsapp_ref: whatsappRef,
    p_credit_amount: input.creditAmount,
    p_notice_title: input.noticeTitle,
    p_notice_message: input.noticeMessage,
  })

  if (error) {
    console.error('[cancelWithCredit] rpc_failed', {
      bookingId: input.bookingId,
      message: error.message,
    })
    return { ok: false, code: 'rpc_failed', error: `取消失敗：${error.message}` }
  }

  const result = (data ?? null) as {
    success?: boolean
    code?: string
    booking_id?: string
    user_id?: string
    credit?: number
    points_reversed?: number
    balance?: number | null
  } | null

  if (!result || result.success !== true) {
    const code = typeof result?.code === 'string' ? result.code : 'unknown'
    return {
      ok: false,
      code,
      error: CODE_MESSAGES[code] ?? `取消失敗（${code}）`,
    }
  }

  return {
    ok: true,
    bookingId: result.booking_id ?? input.bookingId,
    userId: result.user_id ?? '',
    credit: typeof result.credit === 'number' ? result.credit : input.creditAmount,
    pointsReversed: typeof result.points_reversed === 'number' ? result.points_reversed : 0,
    balance: typeof result.balance === 'number' ? result.balance : null,
  }
}
