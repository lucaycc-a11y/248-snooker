import { NextResponse } from 'next/server'
import { requireAppAdmin, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { mapBooking } from '@/lib/admin/app-bookings'
import type { Row } from '@/lib/data/adminReadHelpers'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

// GET /api/admin/app/search?q=  — bookings and members, max 10 each.
// Bookings of hidden accounts are left out (as on the web); members carry a
// `hidden` flag so the app can offer 加入／移出 隱藏帳戶.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  // Strip characters that would break the PostgREST or() filter.
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  if (q.length < 2) return NextResponse.json({ bookings: [], members: [] }, { headers: NO_STORE })

  let hiddenIds: Set<string>
  try {
    hiddenIds = (await getHiddenUserList()).ids
  } catch (err) {
    console.error('[admin/app/search] hidden-user list failed', err)
    return NextResponse.json({ error: 'Could not load hidden accounts' }, { status: 500, headers: NO_STORE })
  }
  const hiddenFilter = hiddenIdFilterValue(hiddenIds)

  const db = getLegacyServiceSupabase()
  let bookingsQ = db
    .from('bookings')
    .select('*')
    .eq('is_test', false)
    .or(`human_code.ilike.%${q}%,booking_reference.ilike.%${q}%,user_email.ilike.%${q}%,user_name.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(10)
  if (hiddenFilter) bookingsQ = bookingsQ.not('user_id', 'in', hiddenFilter)

  const [b, u] = await Promise.all([
    bookingsQ,
    db
      .from('users')
      .select('id, display_name, email, phone, member_code, tier')
      .or(`email.ilike.%${q}%,phone.ilike.%${q}%,member_code.ilike.%${q}%,display_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json(
    {
      bookings: ((b.data ?? []) as Row[]).map((r) => mapBooking(r)),
      members: ((u.data ?? []) as Record<string, unknown>[]).map((m) => ({
        id: m.id,
        displayName: m.display_name ?? null,
        email: m.email ?? null,
        phone: m.phone ?? null,
        memberCode: m.member_code ?? null,
        tier: m.tier ?? null,
        hidden: typeof m.id === 'string' && hiddenIds.has(m.id),
      })),
    },
    { headers: NO_STORE },
  )
}
