import { NextResponse } from 'next/server'
import { requireAppAdmin, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { mapBooking } from '@/lib/admin/app-bookings'
import type { Row } from '@/lib/data/adminReadHelpers'

// GET /api/admin/app/search?q=  — bookings and members, max 10 each.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  // Strip characters that would break the PostgREST or() filter.
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60)
  if (q.length < 2) return NextResponse.json({ bookings: [], members: [] }, { headers: NO_STORE })

  const db = getLegacyServiceSupabase()
  const [b, u] = await Promise.all([
    db
      .from('bookings')
      .select('*')
      .eq('is_test', false)
      .or(`human_code.ilike.%${q}%,booking_reference.ilike.%${q}%,user_email.ilike.%${q}%,user_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10),
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
      })),
    },
    { headers: NO_STORE },
  )
}
