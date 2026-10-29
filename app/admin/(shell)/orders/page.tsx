import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import AdminPageHead from '@/components/admin/AdminPageHead'
import AdminStatusBadge from '@/components/admin/AdminStatusBadge'
import { dateLabel, money } from '@/lib/admin/today'

// 訂單查詢 — latest 100 orders with their payment attempt. Test orders are
// excluded unless ?test=1 is passed (the switch below).

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

async function getOrders(includeTest: boolean, q: string): Promise<{ rows: Row[]; error: string | null }> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component restriction
          }
        },
      },
    },
  )

  let query = supabase
    .from('bookings')
    .select('*, payment_attempts(*)')
    .order('created_at', { ascending: false })
    .limit(100)
  if (!includeTest) query = query.eq('is_test', false)
  if (q) query = query.ilike('human_code', `%${q.replace(/[%_,()]/g, '')}%`)

  const { data, error } = await query
  if (error) {
    console.error('[admin/orders] load failed', error)
    return { rows: [], error: `訂單資料載入失敗：${error.message}` }
  }
  return { rows: (data ?? []) as unknown as Row[], error: null }
}

const PAYMENT_LABEL: Record<string, [string, 'good' | 'warn' | 'bad' | 'mute']> = {
  succeeded: ['已成功', 'good'],
  paid: ['已成功', 'good'],
  pending: ['處理中', 'warn'],
  processing: ['處理中', 'warn'],
  requires_action: ['待驗證', 'warn'],
  failed: ['失敗', 'bad'],
  canceled: ['已取消', 'mute'],
  cancelled: ['已取消', 'mute'],
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; q?: string }> | { test?: string; q?: string }
}) {
  const params = await searchParams
  const includeTest = params.test === '1'
  const q = (params.q ?? '').trim().slice(0, 40)
  const { rows, error } = await getOrders(includeTest, q)

  return (
    <>
      <AdminPageHead
        sub={`最近 100 張訂單${includeTest ? '（包括測試訂單）' : ''}`}
        actions={
          <Link
            href={`/admin/orders?${new URLSearchParams({ ...(includeTest ? {} : { test: '1' }), ...(q ? { q } : {}) })}`}
            className="admin-pill-btn"
          >
            {includeTest ? '隱藏測試訂單' : '包括測試訂單'}
          </Link>
        }
      />

      {error ? (
        <div className="admin-card" role="alert" style={{ borderColor: 'var(--admin-status-danger)' }}>
          {error}
        </div>
      ) : null}

      <section className="admin-card flat">
        <form className="ad-filters" action="/admin/orders" method="get">
          {includeTest ? <input type="hidden" name="test" value="1" /> : null}
          <label className="ad-field" style={{ flex: '2 1 240px' }}>
            <span>預約編號</span>
            <input className="ad-input" name="q" defaultValue={q} placeholder="例如 SPACE8-NQH9F-7" />
          </label>
          <button type="submit" className="ad-btn ad-btn-primary">搜尋</button>
          {q ? <Link href="/admin/orders" className="ad-btn">清除</Link> : null}
        </form>
        <div className="admin-head">
          <h3>訂單列表（{rows.length}）</h3>
        </div>
        {rows.length === 0 && !error ? (
          <div className="admin-empty">暫無訂單記錄</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>預約編號</th>
                  <th>日期</th>
                  <th>時間</th>
                  <th>房間</th>
                  <th>會員</th>
                  <th className="admin-num">金額</th>
                  <th>預約狀態</th>
                  <th>付款</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => {
                  const attempts = Array.isArray(booking.payment_attempts)
                    ? (booking.payment_attempts as Row[])
                    : []
                  const attemptStatus = text(attempts[0]?.status)
                  const mapped = attemptStatus ? PAYMENT_LABEL[attemptStatus] : undefined
                  const code = text(booking.human_code) ?? text(booking.booking_reference) ?? String(booking.id).slice(0, 8)
                  return (
                    <tr key={String(booking.id)}>
                      <td>
                        <Link href={`/admin/bookings/${String(booking.id)}`} className="admin-mono">
                          {code}
                        </Link>
                        {booking.is_test === true ? <> <AdminStatusBadge label="測試" tone="test" /></> : null}
                      </td>
                      <td>{dateLabel(text(booking.date))}</td>
                      <td className="admin-num">
                        {(text(booking.start_time) ?? '—').slice(0, 5)} – {(text(booking.end_time) ?? '—').slice(0, 5)}
                      </td>
                      <td>{booking.table_number ? `房 ${String(booking.table_number)}` : '—'}</td>
                      <td>{text(booking.name) ?? text(booking.user_name) ?? '—'}</td>
                      <td className="admin-num">{money(Number(booking.total_price) || 0)}</td>
                      <td>
                        <AdminStatusBadge status={text(booking.status) ?? 'unknown'} />
                      </td>
                      <td>
                        {attemptStatus ? (
                          <AdminStatusBadge label={mapped?.[0] ?? attemptStatus} tone={mapped?.[1] ?? 'mute'} />
                        ) : (
                          <span className="admin-muted">無付款記錄</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
