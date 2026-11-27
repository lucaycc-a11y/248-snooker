import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// Persists a drag-sorted article order: ids[0] is shown first on the public blog list.
export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  const ids =
    typeof body === 'object' && body !== null && 'ids' in body && Array.isArray((body as { ids: unknown }).ids)
      ? (body as { ids: unknown[] }).ids
      : null
  if (!ids || ids.length === 0 || ids.length > 500 || !ids.every((i): i is string => typeof i === 'string' && /^[0-9a-f-]{36}$/i.test(i))) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = getLegacyServiceSupabase()
  const results = await Promise.all(ids.map((id, index) => service.from('blog_posts').update({ sort_order: index }).eq('id', id)))
  if (results.some((r) => r.error)) {
    console.error('[admin/blog] reorder failed')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
