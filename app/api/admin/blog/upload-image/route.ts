import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Manual image upload for a blog post — same bucket/path convention as the AI
// image-generation route (generate-image/route.ts): blog-images/{postId}/{uuid}.{ext}.
// Accepts multipart form-data, not JSON, since it's a real file.

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    const postId = form?.get('post_id')
    if (!(file instanceof File) || typeof postId !== 'string' || !postId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) return NextResponse.json({ error: 'unsupported_type' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 400 })

    const path = `${postId}/${randomUUID()}.${ext}`
    const service = getServiceSupabase()
    const { error } = await service.storage.from('blog-images').upload(path, file, {
      contentType: file.type,
      cacheControl: '31536000',
    })
    if (error) {
      console.error('[admin/blog/upload-image] upload failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const { data: publicUrl } = service.storage.from('blog-images').getPublicUrl(path)
    return NextResponse.json({ success: true, url: publicUrl.publicUrl })
  } catch (err) {
    console.error('[admin/blog/upload-image] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
