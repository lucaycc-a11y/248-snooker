import { notFound } from 'next/navigation'
import { getServiceSupabase } from '@/lib/supabase/service'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import BookingCancelAction from '@/components/admin/BookingCancelAction'

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
        .select('id, booking_reference, date, status, total_price')
        .eq('user_id', booking.user_id)
        .neq('id', id)
        .order('date', { ascending: false })
        .limit(10)
      otherBookings = (rows ?? []) as Row[]
    } catch {
      /* stays empty */
    }
  }

  return { booking, user, otherBookings }
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

function hhmm(t: string | null): string {
  return (t ?? '').slice(0, 5)
}

export default async function AdminBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getBookingDetail(id)
  if (!result) notFound()
  const { booking, user, otherBookings } = result

  const status = str(booking, ['status']) ?? 'unknown'
  const st = STATUS[status] ?? { label: status, tone: '' as const }
  const method = str(booking, ['payment_method'])
  const refund = num(booking, ['refund_amount'], 0)
  const userId = typeof booking.user_id === 'string' ? booking.user_id : null
  const canCancel = status !== 'refunded' && status !== 'admin_cancelled'

  return (
    <div className="bk-page">
      <Link href="/admin/bookings" className="bk-back">
        <ArrowLeft size={16} aria-hidden /> 返回預約列表
      </Link>

      <section className="admin-card bk-hero">
        <div>
          <p className="bk-code admin-mono">{str(booking, ['booking_reference']) ?? id.slice(0, 8)}</p>
          <div className="bk-tags">
            <span className={`admin-tag${st.tone ? ` ${st.tone}` : ''}`}>{st.label}</span>
            {booking.is_test === true ? <span className="admin-tag warn">測試預約</span> : null}
          </div>
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
          <Field label="付款方式" value={method ? (METHOD[method.toLowerCase()] ?? method) : '—'} />
        </dl>
      </section>

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
        </dl>
      </section>

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
                    <span className="admin-mono">{str(b, ['booking_reference']) ?? String(b.id).slice(0, 8)}</span>
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
