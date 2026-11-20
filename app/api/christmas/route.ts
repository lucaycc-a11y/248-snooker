import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getChristmasPairs } from '@/lib/christmas/pairs'

// Tells the site whether the signed-in user is a chosen Christmas-preview admin.
// Everyone else (visitors, members, other admins) gets { enabled: false }.
// Fails closed on any error.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OFF = NextResponse.json({ enabled: false }, { headers: { 'Cache-Control': 'no-store' } })

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return OFF

    const service = getLegacyServiceSupabase()
    const { data: admin } = await service
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!admin) return OFF

    const { data: chosen } = await service
      .from('christmas_theme_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!chosen) return OFF

    const locale = new URL(req.url).searchParams.get('locale') ?? ''
    const pairs = await getChristmasPairs(locale)
    return NextResponse.json({ enabled: true, pairs }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return OFF
  }
}
