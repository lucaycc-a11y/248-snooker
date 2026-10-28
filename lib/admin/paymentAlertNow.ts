import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { adminMailShell, escapeHtml, mailButton, mailCallout, mailFacts, mailText, sendAdminMail } from '@/lib/admin/alertMail'

// Immediate payment-problem email. Called from logSiteError() the moment a payment-pipeline
// error is recorded (webhook confirm failed, paid order parked for review, duplicate payment,
// order creation failed ...), so the owner hears about it right away instead of waiting for
// a polling job. It reads only; it never changes a booking and never moves money.
//
//  • Real customer + money problem (payments/review, payments/duplicate) -> every active admin.
//  • Everything else, and anything on a test booking                      -> owner only.
//  • Same problem is emailed once (alert_key in admin_alerts), then at most every 12 h.
//  • Hard cap of 8 emails per 10 minutes so an error storm cannot flood the inbox.
//  • Fast and deterministic: no AI call in the request path. The email carries the booking's
//    payment timeline so the cause is usually visible without opening anything.

export const PAYMENT_ALERT_SOURCES: ReadonlySet<string> = new Set([
  'webhooks/kpay',
  'payments/review',
  'payments/duplicate',
  'checkout/create',
  'payment-dev/kpay',
  'checkout/cancel',
  'checkout/status',
])

const CRITICAL_SOURCES: ReadonlySet<string> = new Set(['payments/review', 'payments/duplicate'])
const REMIND_HOURS = 12
const BURST_CAP = 8
const BURST_WINDOW_MIN = 10
const SITE = 'https://space8.com.hk'

type Detail = Record<string, unknown>
const text = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '')

function hk(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(11, 19)
}

export async function alertPaymentProblemNow(input: {
  source: string
  message: string
  detail?: Detail
}): Promise<void> {
  try {
    if (!PAYMENT_ALERT_SOURCES.has(input.source)) return
    if (!process.env.RESEND_API_KEY) return
    const detail = input.detail ?? {}
    const db = getLegacyServiceSupabase()

    let bookingId = text(detail.bookingId, 60) || null
    const orderNo = text(detail.providerOrderNo, 40) || text(detail.orderNo, 40) || text(detail.paidOrderNo, 40) || null
    // Webhook errors only carry the KPay order number: find the booking it belongs to.
    if (!bookingId && orderNo && /^[A-Za-z0-9_-]+$/.test(orderNo)) {
      const { data: byOrder } = await db.from('bookings').select('id').eq('provider_order_no', orderNo).order('created_at', { ascending: false }).limit(1).maybeSingle()
      bookingId = byOrder ? String((byOrder as { id: unknown }).id) : null
    }
    const subject = bookingId ?? orderNo ?? text(detail.eventId, 60) ?? 'general'
    const key = `payment_now:${input.source}:${input.message.slice(0, 60)}:${subject}`

    // Dedupe: one email per problem, a reminder at most every REMIND_HOURS.
    const { data: prev } = await db.from('admin_alerts').select('last_emailed_at, resolved_at').eq('alert_key', key).maybeSingle()
    const lastEmailed = prev && typeof (prev as { last_emailed_at?: unknown }).last_emailed_at === 'string' ? new Date((prev as { last_emailed_at: string }).last_emailed_at).getTime() : null
    if (lastEmailed && Date.now() - lastEmailed < REMIND_HOURS * 3_600_000) return

    // Burst cap across all immediate alerts.
    const since = new Date(Date.now() - BURST_WINDOW_MIN * 60_000).toISOString()
    const { count } = await db.from('admin_alerts').select('alert_key', { count: 'exact', head: true }).like('alert_key', 'payment_now:%').gte('last_emailed_at', since)
    if ((count ?? 0) >= BURST_CAP) return

    // Booking facts + payment timeline (read-only).
    let code: string | null = null
    let status: string | null = null
    let amount: number | null = null
    let isTest = false
    let timeline: { at: string; event: string; source: string; reason: string | null }[] = []
    if (bookingId && /^[0-9a-f-]{36}$/i.test(bookingId)) {
      const { data: b } = await db.from('bookings').select('human_code, status, total_price, is_test').eq('id', bookingId).maybeSingle()
      if (b) {
        const row = b as { human_code?: string | null; status?: string | null; total_price?: number | string | null; is_test?: boolean | null }
        code = row.human_code ?? null
        status = row.status ?? null
        amount = row.total_price == null ? null : Number(row.total_price)
        isTest = row.is_test === true
      }
      const { data: ev } = await db.from('payment_events').select('created_at, event, source, reason').eq('booking_id', bookingId).order('created_at', { ascending: false }).limit(8)
      timeline = ((ev ?? []) as { created_at: string; event: string; source: string; reason: string | null }[])
        .reverse()
        .map((e) => ({ at: hk(e.created_at), event: e.event, source: e.source, reason: e.reason }))
    }

    const critical = CRITICAL_SOURCES.has(input.source) && !isTest
    const label = code ?? (orderNo ? `單號 …${orderNo.slice(-8)}` : input.source)
    const title = `${isTest ? '【測試】' : ''}${critical ? '付款異常' : '付款系統錯誤'}：${label}`
    const reason = text(detail.message, 240) || text(detail.reason, 240) || input.message

    const facts: [string, string][] = [
      ['來源', input.source],
      ['問題', input.message.slice(0, 160)],
      ['原因', reason],
    ]
    if (code) facts.push(['預約', code])
    if (status) facts.push(['預約狀態', status])
    if (amount !== null) facts.push(['金額', `HK$${amount}`])
    if (orderNo) facts.push(['KPay 單號', orderNo])

    const timelineHtml =
      timeline.length > 0
        ? mailCallout(escapeHtml(timeline.map((e) => `${e.at}  ${e.event}（${e.source}）${e.reason ? ` · ${e.reason}` : ''}`).join('\n')))
        : ''

    const guidance = critical
      ? '客人可能已被收款但未得到預約。系統不會自動退款：請到 KPay 後台核實，再在後台處理（退款或補單）。'
      : '這是付款流程中的錯誤，客人未必受影響。請在付款監控查看相關預約的時間線；亦可以直接問 Spark。'

    await sendAdminMail({
      audience: critical ? 'all-admins' : 'owner',
      subject: `${critical ? '【緊急】' : ''}Space8 ${title}`,
      html: adminMailShell(
        title,
        `${mailText(guidance)}${mailFacts(facts)}${timelineHtml}${mailButton(`${SITE}/admin/payment-log${code ? `?q=${encodeURIComponent(code)}` : ''}`, '開啟付款監控')}`,
        critical ? 'critical' : 'normal',
        title,
      ),
    })

    const nowIso = new Date().toISOString()
    await db.from('admin_alerts').upsert(
      {
        alert_key: key,
        severity: critical ? 'high' : 'medium',
        title,
        detail: { text: reason, critical, kind: 'payment_now', source: input.source },
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        last_emailed_at: nowIso,
        resolved_at: null,
      },
      { onConflict: 'alert_key' },
    )
  } catch (e) {
    // Never let alerting break (or loop back into) the payment path.
    console.error('[admin/payment-alert-now] failed', { message: e instanceof Error ? e.message : String(e) })
  }
}
