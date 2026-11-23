import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { looseRpc } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// GET/POST /api/cron/pilot-clips-cleanup — daily: delete expired / member-deleted clips from Storage, then their rows.
// Keeps Storage small: unsaved clips live 24h, saved ones 30 days. Same auth as the other crons.
async function handle(req: Request) {
  const secret = process.env.PAYMENT_RECONCILE_CRON_SECRET
  const vercel = process.env.CRON_SECRET
  const ok =
    (secret && req.headers.get('x-cron-secret') === secret) ||
    (vercel && req.headers.get('authorization') === `Bearer ${vercel}`)
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getServiceSupabase()
  const rpc = looseRpc(supabase)
  const due = await rpc('pilot_clips_due', { p_limit: 200 })
  const paths = Array.isArray(due.data) ? due.data.filter((p): p is string => typeof p === 'string') : []
  if (due.error || paths.length === 0) return NextResponse.json({ removed: 0, error: due.error?.message ?? null })

  const removed = await supabase.storage.from('pilot-clips').remove(paths)
  if (removed.error) return NextResponse.json({ removed: 0, error: removed.error.message }, { status: 207 })
  const purged = await rpc('pilot_clips_purge', { p_paths: paths })
  return NextResponse.json({ removed: paths.length, rows: purged.data ?? 0 })
}

export const GET = handle
export const POST = handle
