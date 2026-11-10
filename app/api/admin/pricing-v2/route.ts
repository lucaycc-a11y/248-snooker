import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Pricing v2 (連訂) kill switch. Flipping enabled=false reverts everyone —
// admins included — to pre-v2 pricing + cutoff instantly (see lib/pricing-v2.ts).
// pricing_v2_config is not in database.types.ts yet, hence the cast.

const db = () => getServiceSupabase() as unknown as SupabaseClient

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function GET() {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db()
    .from('pricing_v2_config')
    .select('enabled, public_from')
    .eq('id', true)
    .maybeSingle()
  if (error) {
    console.error('[admin/pricing-v2] read failed', error)
    return NextResponse.json({ error: '讀取失敗' }, { status: 500 })
  }
  return NextResponse.json({
    enabled: data ? data.enabled !== false : null,
    publicFrom: data ? (data.public_from as string) : null,
  })
}

export async function POST(req: Request) {
  const admin = await getAdminData()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isRecord(body) || typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { error } = await db()
    .from('pricing_v2_config')
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq('id', true)
  if (error) {
    console.error('[admin/pricing-v2] update failed', error)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
  return NextResponse.json({ enabled: body.enabled })
}
