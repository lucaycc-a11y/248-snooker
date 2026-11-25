import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { type Row } from '@/lib/data/adminReadHelpers'
import { hkToday, mapBooking } from '@/lib/admin/app-bookings'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

// GET /api/admin/app/bookings?date=YYYY-MM-DD | ?from=&to= [&status=&includeTest=true&limit=100]
// Defaults to today (Hong Kong). Dates and times are Hong Kong wall-clock.
export const dynamic = 'force-dynamic'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  const p = new URL(req.url).searchParams
  const date = p.get('date')
  const from = date ?? p.get('from') ?? hkToday()
  const to = date ?? p.get('to') ?? from
  if (!YMD.test(from) || !YMD.test(to)) return jsonError('Dates must be YYYY-MM-DD')
  const limitRaw = Number(p.get('limit') ?? '100')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 300) : 100

  const db = getLegacyServiceSupabase()
  let q = db
    .from('bookings')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit)
  // Same rule as the web 今日/預約 screens: test and hidden-account bookings only with includeTest=true.
  if (p.get('includeTest') !== 'true') {
    q = q.eq('is_test', false)
    try {
      const hidden = hiddenIdFilterValue((await getHiddenUserList()).ids)
      if (hidden) q = q.not('user_id', 'in', hidden)
    } catch (err) {
      // Never fall back to "show everything" when the hidden list cannot be read.
      console.error('[admin/app/bookings] hidden-user list failed', err)
      return jsonError('Could not load hidden accounts', 500)
    }
  }
  const status = p.get('status')
  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return jsonError('Could not load bookings', 500)
  const rows = (data ?? []) as Row[]

  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter((v): v is string => typeof v === 'string')))
  const users = new Map<string, { display_name: string | null; phone: string | null }>()
  if (ids.length > 0) {
    const { data: us } = await db.from('users').select('id, display_name, phone').in('id', ids)
    for (const u of (us ?? []) as { id: string; display_name: string | null; phone: string | null }[]) users.set(u.id, u)
  }

  return NextResponse.json(
    {
      from,
      to,
      bookings: rows.map((r) => mapBooking(r, typeof r.user_id === 'string' ? users.get(r.user_id) : null)),
    },
    { headers: NO_STORE },
  )
}
