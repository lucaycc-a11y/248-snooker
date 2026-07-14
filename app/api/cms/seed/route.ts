import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Public, no admin auth — called by anonymous visitor page loads as each
// CMSText mounts with no existing DB row for its key. Pure fill-the-gap
// semantics (ON CONFLICT DO NOTHING via upsert with ignoreDuplicates): can
// never overwrite existing content, only create a row that doesn't exist yet,
// with the exact fallback text already shipped in the deployed bundle. Rate
// limited per-IP anyway since even a no-op insert attempt is a cheap DB-hit
// at unbounded volume otherwise.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

export async function POST(req: Request) {
  try {
    const allowed = await rateLimit('cms_seed', `ip:${clientIp(req)}`, 30, 60)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.key !== 'string' ||
      !body.key.trim() ||
      typeof body.locale !== 'string' ||
      !LOCALES.includes(body.locale) ||
      typeof body.value !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const { error } = await service
      .from('cms_content')
      .upsert(
        { key: body.key, locale: body.locale, value: body.value },
        { onConflict: 'key,locale', ignoreDuplicates: true }
      )

    if (error) {
      console.error('[cms/seed] upsert failed', error)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cms/seed] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
