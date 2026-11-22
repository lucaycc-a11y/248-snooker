import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc, parseMatches, parsePhotos } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/member/pilot — the signed-in member's Space Pilot records and
// private photos. While Space Pilot is an admin-only beta, `enabled` is false
// for everyone else and the UI shows a greyed "beta" card.
// Photos are private: only the owner's session can sign their storage paths.
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rpc = looseRpc(supabase)
  const [matchesRes, photosRes] = await Promise.all([
    rpc('pilot_my_matches', { p_limit: 30 }),
    rpc('pilot_my_photos', { p_limit: 60 }),
  ])
  if (matchesRes.error || photosRes.error) {
    console.error('[member/pilot] rpc failed', matchesRes.error?.message, photosRes.error?.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const { enabled, matches } = parseMatches(matchesRes.data)
  const { photos } = parsePhotos(photosRes.data)

  let signed: { path: string | null; signedUrl: string }[] = []
  if (enabled && photos.length > 0) {
    const { data } = await supabase.storage
      .from('pilot-photos')
      .createSignedUrls(photos.map((p) => p.path), 3600)
    signed = (data ?? []).filter(
      (item): item is { path: string; signedUrl: string; error: null } =>
        typeof item.path === 'string' && typeof item.signedUrl === 'string' && item.signedUrl.length > 0,
    )
  }
  const urlByPath = new Map(signed.map((item) => [item.path ?? '', item.signedUrl]))

  return NextResponse.json({
    enabled,
    matches,
    photos: photos
      .map((p) => ({ id: p.id, kind: p.kind, createdAt: p.createdAt, url: urlByPath.get(p.path) ?? null }))
      .filter((p) => p.url !== null),
  })
}
