import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { num, str, type Row } from '@/lib/data/adminReadHelpers'
import { getHiddenUserList, hiddenIdFilterValue } from '@/lib/data/getHiddenUserIds'

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
  /** Space Wallet credit balance, HKD integer. `users.credits`. */
  credits: number
  /** Prototype `m.reverify` — `users.needs_manual_phone_reverify`. */
  needsManualPhoneReverify: boolean
  /** Prototype `m.verified` — `users.phone_verified`. */
  isPhoneVerified: boolean
  totalSpend: number
  bookingCount: number
  lastActiveAt: string | null
  isBlacklisted: boolean
  /** Account is on `admin_hidden_users` — excluded from lists/totals by default. */
  isHidden: boolean
  createdAt: string | null
}

export type AdminMembersQuery = {
  page?: number
  search?: string | null
  /** 系統 → 「顯示隱藏帳戶」 toggle. Default false: hidden accounts are filtered out. */
  includeHidden?: boolean
}
export type AdminMembersResult = {
  members: AdminMemberRow[]
  total: number
  page: number
  pageSize: number
  /**
   * Load failure message. Non-null means the list is NOT a real empty result —
   * the UI must show an error banner rather than 「找不到會員」.
   */
  error: string | null
}

export async function getAdminMembers(query: AdminMembersQuery): Promise<AdminMembersResult> {
  const page = Math.max(1, query.page ?? 1)
  const search = query.search?.trim()
  const service = getLegacyServiceSupabase()
  const from = (page - 1) * PAGE_SIZE
  const to = page * PAGE_SIZE - 1

  try {
    // Hidden accounts are filtered here, in the shared loader — not in the
    // browser. A read failure throws into the catch below rather than silently
    // listing admin accounts as members.
    const hidden = await getHiddenUserList()
    const excludeHidden = query.includeHidden !== true && hidden.ids.size > 0

    // Column list is schema-checked. `users.last_active_at` does NOT exist —
    // selecting it made the whole query 400 and the old catch returned an
    // empty list, which is why /admin/members said 找不到會員 for everyone.
    let q = service
      .from('users')
      .select('id, member_code, email, display_name, phone, tier, points, credits, needs_manual_phone_reverify, phone_verified, is_blacklisted, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)
    if (excludeHidden) {
      const filter = hiddenIdFilterValue(hidden.ids)
      if (filter) q = q.not('id', 'in', filter)
    }
    if (search) {
      q = q.or(`email.ilike.%${search}%,phone.ilike.%${search}%,member_code.ilike.%${search}%`)
    }
    const { data, error, count } = await q
    if (error) throw error

    const rows = (data ?? []) as Row[]
    const userIds = rows.map((r) => String(r.id))

    // Aggregate spend/booking count/last-active per user in one query rather than N.
    let spendByUser = new Map<string, { total: number; count: number; lastAt: string | null }>()
    if (userIds.length > 0) {
      try {
        const { data: bookingRows } = await service
          .from('bookings')
          .select('user_id, total_price, status, created_at')
          .in('user_id', userIds)
          .eq('status', 'confirmed')
          .eq('is_test', false)
        for (const b of (bookingRows ?? []) as Row[]) {
          const uid = String(b.user_id)
          const price = num(b, ['total_price'], 0)
          const createdAt = str(b, ['created_at'])
          const existing = spendByUser.get(uid) ?? { total: 0, count: 0, lastAt: null }
          const lastAt =
            createdAt && (!existing.lastAt || createdAt > existing.lastAt)
              ? createdAt
              : existing.lastAt
          spendByUser.set(uid, {
            total: existing.total + price,
            count: existing.count + 1,
            lastAt,
          })
        }
      } catch (spendErr) {
        // Spend is secondary — do not fail the list over it, but do say so.
        console.warn('[admin/members] spend aggregate failed', spendErr)
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
        credits: num(r, ['credits'], 0),
        needsManualPhoneReverify: r.needs_manual_phone_reverify === true,
        isPhoneVerified: r.phone_verified === true,
        totalSpend: agg?.total ?? 0,
        bookingCount: agg?.count ?? 0,
        // Derived from bookings.created_at in the aggregate above — `users` has
        // no last_active_at column, which is what the old select 400'd on.
        lastActiveAt: agg?.lastAt ?? null,
        isBlacklisted: r.is_blacklisted === true,
        isHidden: hidden.ids.has(id),
        createdAt: str(r, ['created_at']),
      }
    })

    return { members, total: count ?? 0, page, pageSize: PAGE_SIZE, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/members] query failed', err)
    // Never an empty success — the page must show this message.
    return {
      members: [],
      total: 0,
      page,
      pageSize: PAGE_SIZE,
      error: `會員資料載入失敗：${message}`,
    }
  }
}
