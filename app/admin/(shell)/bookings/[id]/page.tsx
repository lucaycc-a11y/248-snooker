import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import BookingCancelAction from '@/components/admin/BookingCancelAction'
import PaymentReviewAction from '@/components/admin/PaymentReviewAction'

// Manual refund is handled by the existing member self-serve flow / a
// separate refund route — this admin action is a distinct soft-cancel
// (status='admin_cancelled') for no-payment-to-reverse cases, per spec 3.1.

async function getBookingDetail(id: string) {
  const service = getServiceSupabase()
  const { data } = await service.from('bookings').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  const booking = data as Row

  let user: { email: string | null; display_name: string | null; phone: string | null } | null = null
  if (typeof booking.user_id === 'string') {
    const { data: userRow } = await service
      .from('users')
      .select('email, display_name, phone')
      .eq('id', booking.user_id)
      .maybeSingle()
    if (userRow) {
      const u = userRow as Row
      user = { email: str(u, ['email']), display_name: str(u, ['display_name']), phone: str(u, ['phone']) }
    }
  }

  let otherBookings: Row[] = []
  if (typeof booking.user_id === 'string') {
    try {
      const { data: rows } = await service
        .from('bookings')
        .select('id, human_code, booking_reference, date, status, total_price')
        .eq('user_id', booking.user_id)
        .neq('id', id)
        .order('date', { ascending: false })
        .limit(10)
      otherBookings = (rows ?? []) as Row[]
    } catch {
      /* stays empty */
    }
  }

  let attempts: Row[] = []
  let events: Row[] = []
  let groupCount = 0
  try {
    const legacy = getLegacyServiceSupabase()
    const { data: a } = await legacy
      .from('payment_attempts')
      .select('provider, provider_order_no, status, failure_reason, created_at, completed_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .limit(30)
    attempts = (a ?? []) as Row[]
    const { data: ev } = await legacy
      .from('payment_events')
      .select('event, source, from_state, to_state, reason, created_at')
      .eq('booking_id', id)
      .order('created_at', { ascending: true })
      .limit(60)
    events = (ev ?? []) as Row[]
    if (typeof booking.order_group_id === 'string') {
      const { count } = await service.from('bookings').select('id', { count: 'exact', head: true }).eq('order_group_id', booking.order_group_id)
      groupCount = count ?? 0
    }
  } catch {
    /* sections stay empty */
  }

  // When it was paid: the first time the booking reached "confirmed", else the successful attempt.
  const confirmedEvent = events.find((e) => e.to_state === 'confirmed')
  const okAttempt = attempts.find((x) => x.status === 'succeeded')
  const paidAt = str(confirmedEvent ?? {}, ['created_at']) ?? str(okAttempt ?? {}, ['completed_at'])

  return { booking, user, otherBookings, attempts, events, groupCount, paidAt }
}

const STATUS: Record<string, { label: string; tone: '' | 'warn' | 'bad' }> = {
  confirmed: { label: '已確認', tone: '' },
  pending: { label: '待付款', tone: 'warn' },
  payment_review: { label: '付款待核實', tone: 'warn' },
  cancelled: { label: '已取消', tone: 'bad' },
  admin_cancelled: { label: '後台已取消', tone: 'bad' },
  expired: { label: '已逾時', tone: 'bad' },
  refunded: { label: '已退款', tone: 'bad' },
}

const METHOD: Record<string, string> = {
  alipayhk: '支付寶 HK',
  payme: 'PayMe',
  fps: 'FPS 轉數快',
  wechat: '微信支付',
  wechatpay: '微信支付',
  card: '信用卡',
  credit: 'Space Credit',
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bk-field">
      <dt>{label}</dt>
      <dd className={mono ? 'admin-mono' : undefined}>{value}</dd>
    </div>
  )
}

function hk(iso: string | null): string {
  if (!iso) return '—'
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '—'
  return new Date(t.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')
}

const ATTEMPT: Record<string, string> = { succeeded: '成功', failed: '失敗', expired: '逾時', cancelled: '已取消', pending: '處理中', claimed: '處理中' }
const EVENT: Record<string, string> = {
  confirmed: '預約確認',
  webhook_paid_confirmed: 'KPay 通知：已付款並確認',
  status_poll_confirmed: '付款確認（頁面查詢）',
  paymentx_paid_confirmed: '全託管付款確認',
  paymentx_order_created: '建立全託管付款單',
  paymentx_order_closed: '全託管付款單已關閉',
  swept_expired: '逾時未付，自動取消',
  cancelled_by_user: '客人取消',
  cancel_refused: '取消被拒絕',
  webhook_closed_or_failed: 'KPay 通知：失敗或關閉',
  reconcile_order_closed: '對賬：付款單已關閉',
  reconcile_paid_confirm_failed: '對賬：已付款但未能確認',
  confirm_rejected: '確認被拒絕',
  paid_unconfirmable: '已付款但無法確認',
  paid_slot_conflict: '已付款但時段被佔用',
  incident_parked: '轉入付款待審核',
  duplicate_payment: '重複付款',
  superseded_open_order: '舊付款單被取代',
}

function hhmm(t: string | null): string {
  return (t ?? '').slice(0, 5)
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getBookingDetail(id)
  if (!result) notFound()
  const { booking, user, otherBookings, attempts, events, groupCount, paidAt } = result

  const status = str(booking, ['status']) ?? 'unknown'
  const st = STATUS[status] ?? { label: status, tone: '' as const }
  const method = str(booking, ['payment_method'])
  const refund = num(booking, ['refund_amount'], 0)
  const userId = typeof booking.user_id === 'string' ? booking.user_id : null
  const inReview = status === 'payment_review'
  const canCancel = status !== 'refunded' && status !== 'admin_cancelled' && !inReview

  return (
    <div className="bk-page">
      <Link href="/admin/bookings" className="bk-back">
        <ArrowLeft size={16} aria-hidden /> 返回預約列表
      </Link>

      <section className="admin-card bk-hero">
        <div>
          <p className="bk-code admin-mono">{str(booking, ['human_code', 'booking_reference']) ?? id.slice(0, 8)}</p>
          <div className="bk-tags">
            <span className={`admin-tag${st.tone ? ` ${st.tone}` : ''}`}>{st.label}</span>
            {booking.is_test === true ? <span className="admin-tag warn">測試預約</span> : null}
          </div>
          <p className="admin-cell-sub" style={{ marginTop: 8 }}>
            建立 {hk(str(booking, ['created_at']))}
            {' · '}
            {paidAt ? `付款 ${hk(paidAt)}` : status === 'pending' ? '未付款' : '沒有付款記錄'}
          </p>
        </div>
        <div className="bk-amount">
          <small>金額</small>
          <b className="admin-num">HK${num(booking, ['total_price'], 0)}</b>
          {refund > 0 ? <small>已退款 HK${refund}</small> : null}
        </div>
      </section>

      <section className="admin-card bk-card">
        <h3>預約資料</h3>
        <dl className="bk-grid">
          <Field label="日期" value={str(booking, ['date']) ?? '—'} />
          <Field label="時間" value={`${hhmm(str(booking, ['start_time']))} – ${hhmm(str(booking, ['end_time']))}`} />
          <Field label="房間" value={`房 ${num(booking, ['table_number'], 0)}`} />
          <Field label="時數" value={`${num(booking, ['duration_hours'], 0)} 小時`} />
          <Field label="時段" value={str(booking, ['period']) ?? '—'} />
          <Field label="會員編號" value={str(booking, ['member_code']) ?? '—'} mono />
          {groupCount > 1 ? <Field label="同一訂單" value={`共 ${groupCount} 張預約`} /> : null}
          {num(booking, ['reschedule_count'], 0) > 0 ? <Field label="改期" value={`${num(booking, ['reschedule_count'], 0)} 次 · 最近 ${hk(str(booking, ['rescheduled_at']))}`} /> : null}
          {booking.is_free_booking === true ? <Field label="免費預約" value="是" /> : null}
          {str(booking, ['cancellation_reason']) ? <Field label="取消原因" value={str(booking, ['cancellation_reason']) ?? ''} /> : null}
        </dl>
        {str(booking, ['admin_note']) && !inReview ? <p className="admin-mono" style={{ whiteSpace: 'pre-wrap', marginTop: 12, fontSize: 13 }}>備註：{str(booking, ['admin_note'])}</p> : null}
      </section>

      <section className="admin-card bk-card">
        <h3>價錢與付款</h3>
        <dl className="bk-grid">
          {num(booking, ['base_price'], 0) > 0 && num(booking, ['base_price'], 0) !== num(booking, ['total_price'], 0) ? <Field label="原價" value={`HK$${num(booking, ['base_price'], 0)}`} /> : null}
          {num(booking, ['promo_discount'], 0) > 0 ? <Field label={`優惠碼${str(booking, ['promo_code']) ? ` ${str(booking, ['promo_code'])}` : ''}`} value={`− HK$${num(booking, ['promo_discount'], 0)}`} /> : null}
          {num(booking, ['points_discount'], 0) > 0 ? <Field label={`積分折扣（${num(booking, ['points_redeemed'], 0)} 分）`} value={`− HK$${num(booking, ['points_discount'], 0)}`} /> : null}
          {num(booking, ['credit_discount'], 0) > 0 ? <Field label="Space Credit" value={`− HK$${num(booking, ['credit_discount'], 0)}`} /> : null}
          <Field label="應付 / 實收" value={`HK$${num(booking, ['total_price'], 0)}`} />
          <Field label="付款方式" value={method ? (METHOD[method.toLowerCase()] ?? method) : '—'} />
          <Field label="付款時間" value={hk(paidAt)} />
          <Field label="付款渠道" value={str(booking, ['payment_provider']) ?? '—'} />
          <Field label="渠道訂單號" value={str(booking, ['provider_order_no']) ?? '—'} mono />
          <Field label="交易參考" value={str(booking, ['stripe_payment_intent']) ?? '—'} mono />
          {refund > 0 ? <Field label="退款" value={`HK$${refund}${num(booking, ['refund_fee'], 0) > 0 ? `（手續費 HK$${num(booking, ['refund_fee'], 0)}）` : ''} · ${hk(str(booking, ['refunded_at']))}`} /> : null}
        </dl>
      </section>

      <section className="admin-card bk-card">
        <h3>時間與電郵</h3>
        <dl className="bk-grid">
          <Field label="建立時間" value={hk(str(booking, ['created_at']))} />
          <Field label="最後更新" value={hk(str(booking, ['updated_at']))} />
          <Field label="確認電郵" value={str(booking, ['confirmation_email_sent_at']) ? `已發送 ${hk(str(booking, ['confirmation_email_sent_at']))}` : '未發送'} />
          <Field label="提醒電郵" value={str(booking, ['reminder_email_sent_at']) ? `已發送 ${hk(str(booking, ['reminder_email_sent_at']))}` : '未發送'} />
          <Field label="預約 ID" value={id} mono />
        </dl>
      </section>

      {attempts.length > 0 || events.length > 0 ? (
        <section className="admin-card bk-card">
          <h3>付款經過</h3>
          {attempts.length > 0 ? (
            <ul className="bk-list">
              {attempts.map((x, i) => {
                const label = ATTEMPT[String(x.status)] ?? String(x.status)
                const tone = x.status === 'succeeded' ? '' : x.status === 'pending' || x.status === 'claimed' ? 'warn' : 'bad'
                return (
                  <li key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '8px 0' }}>
                    <span className={`admin-tag${tone ? ` ${tone}` : ''}`}>{label}</span>
                    <span className="admin-cell-sub">{hk(str(x, ['created_at']))}{x.completed_at ? ` → ${hk(str(x, ['completed_at']))}` : ''}</span>
                    <span className="admin-mono" style={{ fontSize: 12 }}>{str(x, ['provider']) ?? ''} {str(x, ['provider_order_no']) ?? ''}</span>
                    {str(x, ['failure_reason']) ? <span className="admin-cell-sub">{str(x, ['failure_reason'])}</span> : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
          {events.length > 0 ? (
            <ul className="bk-list" style={{ marginTop: 12 }}>
              {events.map((e, i) => (
                <li key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', padding: '6px 0' }}>
                  <span className="admin-cell-sub" style={{ minWidth: 118 }}>{hk(str(e, ['created_at']))}</span>
                  <span>{EVENT[String(e.event)] ?? String(e.event)}</span>
                  {str(e, ['reason']) ? <span className="admin-cell-sub">{str(e, ['reason'])}</span> : null}
                  <span className="admin-cell-sub">{str(e, ['source']) ?? ''}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="admin-card bk-card">
        <div className="bk-card-head">
          <h3>客人</h3>
          {userId ? (
            <Link href={`/admin/members/${userId}`} className="admin-pill-btn sm">
              查看會員
            </Link>
          ) : null}
        </div>
        <dl className="bk-grid">
          <Field label="姓名" value={user?.display_name ?? user?.email ?? '訪客'} />
          <Field label="電話" value={user?.phone ?? '—'} />
          <Field label="電郵" value={user?.email ?? '—'} />
          <Field label="會員編號" value={str(booking, ['member_code']) ?? '—'} mono />
        </dl>
      </section>

      {inReview ? (
        <section className="admin-card bk-card" style={{ borderColor: 'var(--admin-status-warning)' }}>
          <div>
            <h3>付款待審核</h3>
            <p>客人已經付款，但系統未能自動確認這張預約（通常係時段已被其他客人佔用）。請決定：仍可確認就確認；否則先在 KPay 退款，再標記「已退款」。</p>
            {str(booking, ['admin_note']) ? (
              <p className="admin-mono" style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 13 }}>{str(booking, ['admin_note'])}</p>
            ) : null}
          </div>
          <PaymentReviewAction bookingId={id} />
        </section>
      ) : null}

      {canCancel ? (
        <section className="admin-card bk-card bk-danger">
          <div>
            <h3>取消這張預約</h3>
            <p>釋放房間時段並標記為「後台已取消」。此操作不會自動退款；如需退款請另行處理。</p>
          </div>
          <BookingCancelAction bookingId={id} compact />
        </section>
      ) : null}

      {otherBookings.length > 0 ? (
        <section className="admin-card bk-card">
          <h3>此客人的其他預約</h3>
          <ul className="bk-list">
            {otherBookings.map((b) => {
              const bs = STATUS[str(b, ['status']) ?? ''] ?? { label: str(b, ['status']) ?? '', tone: '' as const }
              return (
                <li key={String(b.id)}>
                  <Link href={`/admin/bookings/${String(b.id)}`}>
                    <span className="admin-mono">{str(b, ['human_code', 'booking_reference']) ?? String(b.id).slice(0, 8)}</span>
                    <span className="admin-cell-sub">{str(b, ['date']) ?? ''}</span>
                    <span className={`admin-tag${bs.tone ? ` ${bs.tone}` : ''}`}>{bs.label}</span>
                    <span className="admin-num">HK${num(b, ['total_price'], 0)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
