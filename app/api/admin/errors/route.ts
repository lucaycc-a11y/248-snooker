/**
 * Admin site error log API — collection.
 *
 * GET: paginated `site_error_log` rows with open/all filter.
 * PATCH of a single row lives in ./[id]/route.ts.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const offset = (page - 1) * PAGE_SIZE
    const resolved = url.searchParams.get('resolved')

    const service = getLegacyServiceSupabase()
    let query = service
      .from('site_error_log')
      .select('id, source, severity, message, detail, created_at, resolved', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (resolved === 'true') query = query.eq('resolved', true)
    if (resolved === 'false') query = query.eq('resolved', false)

    const { data, count, error } = await query
    if (error) {
      console.error('[admin/errors] query error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      rows: data ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error('[admin/errors] GET error', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
