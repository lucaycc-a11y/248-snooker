import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

// GET /api/admin/cases/lookup?q=<name|code|phone|email>   → matching members (max 8)
// GET /api/admin/cases/lookup?code=<member code>          → that member's recent bookings (max 8)
// Makes opening a case a tap-to-pick job instead of typing a member code on a phone.
export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const db = getLegacyServiceSupabase()

    const code = url.searchParams.get('code')?.trim()
    if (code) {
      const { data: u } = await db.from('users').select('id').ilike('member_code', code).maybeSingle()
      if (!isRec(u) || typeof u.id !== 'string') return NextResponse.json({ bookings: [] })
      const { data } = await db
        .from('bookings')
        .select('human_code, date, start_time, end_time, status')
        .eq('user_id', u.id)
        .not('human_code', 'is', null)
        .order('date', { ascending: false })
        .limit(8)
      const bookings = ((data ?? []) as unknown[])
        .filter(isRec)
        .map((b) => ({ code: str(b.human_code), date: str(b.date), start: str(b.start_time), end: str(b.end_time), status: str(b.status) }))
        .filter((b) => b.code !== null)
      return NextResponse.json({ bookings })
    }

    // Only plain characters reach the PostgREST filter (no commas / parentheses / wildcards).
    const q = (url.searchParams.get('q') ?? '').replace(/[^\p{L}\p{N}@.+\- ]/gu, '').trim().slice(0, 40)
    if (q.length < 2) return NextResponse.json({ members: [] })
    const { data } = await db
      .from('users')
      .select('member_code, display_name, phone, email, is_blacklisted')
      .not('member_code', 'is', null)
      .or(`member_code.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    const members = ((data ?? []) as unknown[]).filter(isRec).map((u) => ({
      code: str(u.member_code),
      name: str(u.display_name),
      phone: str(u.phone),
      email: str(u.email),
      blacklisted: u.is_blacklisted === true,
    }))
    return NextResponse.json({ members })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 })
  }
}
