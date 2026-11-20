import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Release a test version to everyone: sets released_at = now(). Admin-only.
// public.app_versions is not in database.types.ts yet, hence the cast.

const db = () => getServiceSupabase() as unknown as SupabaseClient

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isRecord(body) || typeof body.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(body.version)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data, error } = await db()
    .from('app_versions')
    .update({ released_at: new Date().toISOString() })
    .eq('version', body.version)
    .gt('released_at', new Date().toISOString())
    .select('version')
  if (error) {
    console.error('[admin/versions/release] update failed', error)
    return NextResponse.json({ error: '發佈失敗' }, { status: 500 })
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: '找不到測試版本或已發佈' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, version: body.version })
}
