import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'
import { generateImage, VectorEngineConfigError } from '@/lib/ai/vectorengine'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.post_id !== 'string' || typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const postId = body.post_id
    const prompt = `Editorial cover photo for a snooker/billiards club blog post: ${body.prompt.trim().slice(0, 500)}. Photorealistic, warm cinematic lighting, no text or logos.`

    const image = await generateImage(prompt)
    let bytes: Uint8Array
    if ('b64Json' in image) {
      bytes = Uint8Array.from(Buffer.from(image.b64Json, 'base64'))
    } else {
      const fetched = await fetch(image.url)
      if (!fetched.ok) return NextResponse.json({ error: 'image_fetch_failed' }, { status: 502 })
      bytes = new Uint8Array(await fetched.arrayBuffer())
    }

    const path = `${postId}/${randomUUID()}.png`
    const service = getServiceSupabase()
    const { error } = await service.storage.from('blog-images').upload(path, bytes, {
      contentType: 'image/png',
      cacheControl: '31536000',
    })
    if (error) {
      console.error('[admin/blog/generate-image] storage upload failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    const { data: publicUrl } = service.storage.from('blog-images').getPublicUrl(path)

    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'blog_post_ai_image_generated',
      target_table: 'blog_posts',
      target_id: postId,
      before_value: null,
      after_value: { url: publicUrl.publicUrl },
    })

    return NextResponse.json({ success: true, url: publicUrl.publicUrl })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[admin/blog/generate-image] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[admin/blog/generate-image] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
