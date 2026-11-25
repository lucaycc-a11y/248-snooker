import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'
import { sendApns, apnsConfigured, type ApnsEnvironment } from '@/lib/push/apns'

// Admin activity feed + push. Every event is stored in app_admin_feed (so the app
// can show a list even if push is off) and then pushed to the admins' devices.

export type AdminFeedKind = 'booking_new'

type DeviceRow = { token: string; environment: ApnsEnvironment; prefs: unknown }

function prefAllows(prefs: unknown, kind: string): boolean {
  if (typeof prefs !== 'object' || prefs === null) return true
  return (prefs as Record<string, unknown>)[kind] !== false
}

export async function notifyAdmins(input: {
  kind: AdminFeedKind
  title: string
  body: string
  data?: Record<string, string>
  dedupeKey?: string
}): Promise<{ stored: boolean; sent: number }> {
  const db = getLegacyServiceSupabase()

  const { error: insertError } = await db.from('app_admin_feed').insert({
    kind: input.kind,
    title: input.title,
    body: input.body,
    data: input.data ?? {},
    dedupe_key: input.dedupeKey ?? null,
  })
  if (insertError) {
    // 23505 = unique violation on dedupe_key: already announced, do not push twice.
    if (insertError.code !== '23505') console.error('[push] feed insert failed', insertError.message)
    return { stored: false, sent: 0 }
  }

  if (!apnsConfigured()) return { stored: true, sent: 0 }

  const { data: admins } = await db.from('admin_users').select('user_id').eq('invite_status', 'active')
  const adminIds = ((admins ?? []) as { user_id: string | null }[])
    .map((a) => a.user_id)
    .filter((v): v is string => typeof v === 'string')
  if (adminIds.length === 0) return { stored: true, sent: 0 }

  const { data: devices } = await db
    .from('app_push_devices')
    .select('token, environment, prefs')
    .in('user_id', adminIds)
    .eq('enabled', true)
  const targets = ((devices ?? []) as DeviceRow[]).filter((d) => prefAllows(d.prefs, input.kind))

  let sent = 0
  await Promise.all(
    targets.map(async (d) => {
      const res = await sendApns(d.token, d.environment, {
        title: input.title,
        body: input.body,
        data: { kind: input.kind, ...(input.data ?? {}) },
        threadId: input.kind,
      })
      if (res.ok) {
        sent += 1
      } else {
        console.error('[push] apns failed', { reason: res.reason, status: res.status })
        if (res.invalidToken) await db.from('app_push_devices').delete().eq('token', d.token)
      }
    }),
  )
  return { stored: true, sent }
}

type BookingRow = {
  id: string
  human_code: string | null
  date: string
  start_time: string
  end_time: string
  table_number: number | null
  total_price: number | null
  is_test: boolean
  user_id: string | null
}

/** "New booking" alert. Never throws; test bookings are skipped. */
export async function notifyNewBooking(bookingId: string): Promise<void> {
  try {
    const db = getLegacyServiceSupabase()
    const { data } = await db
      .from('bookings')
      .select('id, human_code, date, start_time, end_time, table_number, total_price, is_test, user_id')
      .eq('id', bookingId)
      .maybeSingle()
    const b = data as BookingRow | null
    if (!b || b.is_test) return
    // Hidden (admin/test) accounts are excluded from every web list; no alert for them either.
    if (b.user_id && (await getHiddenUserList()).ids.has(b.user_id)) return

    let name = ''
    if (b.user_id) {
      const { data: u } = await db.from('users').select('display_name').eq('id', b.user_id).maybeSingle()
      name = ((u as { display_name: string | null } | null)?.display_name ?? '').trim()
    }
    const hm = (t: string) => t.slice(0, 5)
    const room = b.table_number ? `${b.table_number} 號枱` : ''
    await notifyAdmins({
      kind: 'booking_new',
      title: '新預約',
      body: [name, `${b.date} ${hm(b.start_time)}–${hm(b.end_time)}`, room].filter(Boolean).join(' · '),
      data: { bookingId: b.id, ...(b.human_code ? { humanCode: b.human_code } : {}) },
      dedupeKey: `booking:${b.id}`,
    })
  } catch (err) {
    console.error('[push] notifyNewBooking failed', err)
  }
}
