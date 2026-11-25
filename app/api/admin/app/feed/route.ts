import { NextResponse } from 'next/server'
import { requireAppAdmin, jsonError, NO_STORE } from '@/lib/admin/app-guard'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// GET /api/admin/app/feed?limit=30&before=<ISO created_at>
// Shared admin activity feed (new bookings, …) with this admin's unread count.
export const dynamic = 'force-dynamic'

type FeedRow = { id: string; kind: string; title: string; body: string; data: unknown; created_at: string }

export async function GET(req: Request) {
  const g = await requireAppAdmin(req)
  if (!g.ok) return g.res

  const url = new URL(req.url)
  const limitRaw = Number(url.searchParams.get('limit') ?? '30')
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 30
  const before = url.searchParams.get('before')
  if (before && Number.isNaN(Date.parse(before))) return jsonError('Invalid before')

  const db = getLegacyServiceSupabase()
  let q = db
    .from('app_admin_feed')
    .select('id, kind, title, body, data, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const [{ data, error }, state] = await Promise.all([
    q,
    db.from('app_admin_feed_state').select('last_read_at').eq('user_id', g.admin.userId).maybeSingle(),
  ])
  if (error) return jsonError('Could not load feed', 500)

  const lastRead = (state.data as { last_read_at: string } | null)?.last_read_at ?? null
  let unreadQ = db.from('app_admin_feed').select('id', { count: 'exact', head: true })
  if (lastRead) unreadQ = unreadQ.gt('created_at', lastRead)
  const { count } = await unreadQ

  const items = ((data ?? []) as FeedRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    data: r.data,
    createdAt: r.created_at,
    unread: lastRead === null || r.created_at > lastRead,
  }))
  return NextResponse.json({ items, unreadCount: count ?? 0, nextBefore: items.length === limit ? items[items.length - 1].createdAt : null }, { headers: NO_STORE })
}
