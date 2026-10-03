import { NextRequest, NextResponse } from 'next/server'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { rateLimit } from '@/lib/rate-limit'

interface FeedbackBody {
  articleId: string
  helpful: boolean
  comment?: string
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 submissions per hour per IP
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  const allowed = await rateLimit('help-feedback', ip, 5, 3600)

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many feedback submissions. Please try again later.' },
      { status: 429 }
    )
  }

  let body: FeedbackBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { articleId, helpful, comment } = body

  if (!articleId || typeof helpful !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing required fields: articleId, helpful' },
      { status: 400 }
    )
  }

  // Insert feedback
  const supabase = getLegacyServiceSupabase()
  const { error } = await supabase.from('help_feedback').insert({
    article_id: articleId,
    helpful,
    comment: comment || null,
    ip_address: ip,
  })

  if (error) {
    console.error('[help/feedback] Failed to insert feedback:', error)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
