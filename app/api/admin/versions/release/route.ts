import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Release a test version to everyone: sets released_at = now(). Admin-only.
// public.app_versions is not in database.types.ts yet, hence the cast.

const db = () => getServiceSupabase() as unknown as SupabaseClient

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

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

  // Releasing a test version also releases every earlier still-test version:
  // later builds contain the earlier ones' changes (and feature gates key on them).
  const target = body.version
  const nowIso = new Date().toISOString()
  const { data: pending, error: readErr } = await db()
    .from('app_versions')
    .select('version')
    .gt('released_at', nowIso)
  if (readErr) {
    console.error('[admin/versions/release] read failed', readErr)
    return NextResponse.json({ error: '發佈失敗' }, { status: 500 })
  }
  const toRelease = ((pending ?? []) as { version: string }[])
    .map((r) => r.version)
    .filter((v) => compareSemver(v, target) <= 0)
  if (!toRelease.includes(target)) {
    return NextResponse.json({ error: '找不到測試版本或已發佈' }, { status: 404 })
  }
  const { error } = await db()
    .from('app_versions')
    .update({ released_at: nowIso })
    .in('version', toRelease)
  if (error) {
    console.error('[admin/versions/release] update failed', error)
    return NextResponse.json({ error: '發佈失敗' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, version: body.version })
}
