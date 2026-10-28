import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'nodejs'

// Image for an email: stored in the public blog-images bucket under email/, so the URL works in any inbox.
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

export const POST = withAdminSecurity(
  async (req) => {
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: '請揀圖片檔案' }, { status: 400 })
    const ext = ALLOWED[file.type]
    if (!ext) return NextResponse.json({ error: '只支援 PNG、JPG、WebP、GIF' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: '圖片不可超過 5MB' }, { status: 400 })
    const path = `email/${randomUUID()}.${ext}`
    const service = getServiceSupabase()
    const { error } = await service.storage.from('blog-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) {
      console.error('[admin/email/upload-image] upload failed', error)
      return NextResponse.json({ error: '上載失敗，請再試' }, { status: 500 })
    }
    const { data } = service.storage.from('blog-images').getPublicUrl(path)
    return NextResponse.json({ ok: true, url: data.publicUrl })
  },
  { rateLimit: { bucket: 'admin_email_upload', max: 40, windowSeconds: 3600, identifierType: 'user' } },
)
