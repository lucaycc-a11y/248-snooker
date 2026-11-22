import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { looseRpc, parsePhotos } from '@/lib/member/pilot-rpc'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/member/pilot/photos?id=<uuid> — the owner deletes one of their photos.
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rpc = looseRpc(supabase)
  // Only the caller's own photos come back, so a foreign id simply isn't found.
  const list = await rpc('pilot_my_photos', { p_limit: 200 })
  if (list.error) return NextResponse.json({ error: 'internal' }, { status: 500 })
  const photo = parsePhotos(list.data).photos.find((p) => p.id === id)
  if (!photo) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const removed = await supabase.storage.from('pilot-photos').remove([photo.path])
  if (removed.error) {
    console.error('[member/pilot/photos] storage remove failed', removed.error.message)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
  const marked = await rpc('pilot_delete_photo', { p_id: id })
  if (marked.error) return NextResponse.json({ error: 'internal' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
