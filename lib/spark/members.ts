/**
 * Member lookup for Spark.
 *  • `searchMembers` feeds the member picker in the browser. The admin may see names, emails and
 *    phones (they can on /admin/members); this result is NEVER passed to the AI model.
 *  • `resolveMemberCodes` is what the model may call: it takes whatever the admin typed (an
 *    email, a phone, a name, a code) and returns member codes only — no personal details.
 */

import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'

export type MemberHit = {
  code: string
  name: string | null
  email: string | null
  phoneTail: string | null
  tier: string
  credits: number
  points: number
  blacklisted: boolean
  hidden: boolean
}

type Row = Record<string, unknown>

export async function searchMembers(rawQuery: string, limit = 8): Promise<MemberHit[]> {
  const raw = rawQuery.replace(/[%_\\,()*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  const svc = getLegacyServiceSupabase()
  let q = svc
    .from('users')
    .select('id, member_code, email, display_name, phone, tier, points, credits, is_blacklisted, created_at')
    .not('member_code', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 15))
  if (raw) {
    const tight = raw.replace(/\s+/g, '')
    const clauses = [`email.ilike.%${raw}%`, `display_name.ilike.%${raw}%`, `phone.ilike.%${raw}%`, `member_code.ilike.%${raw}%`]
    if (tight !== raw) clauses.push(`phone.ilike.%${tight}%`, `member_code.ilike.%${tight}%`)
    q = q.or(clauses.join(','))
  }
  const { data, error } = await q
  if (error) throw new Error('搜尋會員失敗')
  const hidden = await getHiddenUserList()
  return ((data ?? []) as Row[]).map((r) => ({
    code: String(r.member_code),
    name: typeof r.display_name === 'string' && r.display_name.trim() !== '' ? r.display_name : null,
    email: typeof r.email === 'string' ? r.email : null,
    phoneTail: typeof r.phone === 'string' && r.phone.length >= 4 ? r.phone.slice(-4) : null,
    tier: String(r.tier ?? 'amateur'),
    credits: Number(r.credits ?? 0),
    points: Number(r.points ?? 0),
    blacklisted: r.is_blacklisted === true,
    hidden: hidden.ids.has(String(r.id)),
  }))
}

/** For the model: codes only. */
export async function resolveMemberCodes(query: string): Promise<{ codes: string[]; total: number }> {
  const hits = await searchMembers(query, 6)
  return { codes: hits.map((h) => h.code), total: hits.length }
}
