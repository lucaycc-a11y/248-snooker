import { getServiceSupabase } from '@/lib/supabase/service'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'

// Shared query logic for /admin/members. Aggregates per-user spend/booking
// count from `bookings` in the API layer (not per-row client-side), per the
// spec. Same schema caveat as getAdminBookings.ts — users/bookings columns
// are RPC-confirmed, not migration-confirmed.

const PAGE_SIZE = 50

export type AdminMemberRow = {
  id: string
  memberCode: string | null
  email: string | null
  displayName: string | null
  phone: string | null
  tier: string | null
  points: number
  totalSpend: number
  bookingCount: number
  lastActiveAt: string | null
  isBlacklisted: boolean
  createdAt: string | null
}

export type AdminMembersQuery = { page?: number; search?: string | null }
export type AdminMembersResult = { members: AdminMemberRow[]; total: number; page: number; pageSize: number }

export async function getAdminMembers(query: AdminMembersQuery): Promise<AdminMembersResult> {
  const page = Math.max(1, query.page ?? 1)
  const search = query.search?.trim()
  const service = getServiceSupabase()
  const from = (page - 1) * PAGE_SIZE
  const to = page * PAGE_SIZE - 1

  try {
    let q = service
      .from('users')
      .select('id, member_code, email, display_name, phone, tier, points, last_active_at, is_blacklisted, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (search) {
      q = q.or(`email.ilike.%${search}%,phone.ilike.%${search}%,member_code.ilike.%${search}%`)
    }
    const { data, error, count } = await q
    if (error) throw error

    const rows = (data ?? []) as Row[]
    const userIds = rows.map((r) => String(r.id))

    // Aggregate spend/booking count per user in one query rather than N.
    let spendByUser = new Map<string, { total: number; count: number }>()
    if (userIds.length > 0) {
      try {
        const { data: bookingRows } = await service
          .from('bookings')
          .select('user_id, total_price, status')
          .in('user_id', userIds)
          .eq('status', 'confirmed')
          .eq('is_test', false)
        for (const b of (bookingRows ?? []) as Row[]) {
          const uid = String(b.user_id)
          const price = num(b, ['total_price'], 0)
          const existing = spendByUser.get(uid) ?? { total: 0, count: 0 }
          spendByUser.set(uid, { total: existing.total + price, count: existing.count + 1 })
        }
      } catch {
        /* stays empty — spend/count show as 0 */
      }
    }

    const members: AdminMemberRow[] = rows.map((r) => {
      const id = String(r.id)
      const agg = spendByUser.get(id)
      return {
        id,
        memberCode: str(r, ['member_code']),
        email: str(r, ['email']),
        displayName: str(r, ['display_name']),
        phone: str(r, ['phone']),
        tier: str(r, ['tier']),
        points: num(r, ['points'], 0),
        totalSpend: agg?.total ?? 0,
        bookingCount: agg?.count ?? 0,
        lastActiveAt: str(r, ['last_active_at']),
        isBlacklisted: r.is_blacklisted === true,
        createdAt: str(r, ['created_at']),
      }
    })

    return { members, total: count ?? 0, page, pageSize: PAGE_SIZE }
  } catch (err) {
    console.error('[admin/members] query failed', err)
    return { members: [], total: 0, page, pageSize: PAGE_SIZE }
  }
}
