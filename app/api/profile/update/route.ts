import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { validateNamePhone } from '@/lib/auth/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // reads auth cookies — never prerender

// POST /api/profile/update  { name, phone }
// Settings-tab profile save. Authed; re-validates name + phone with the SAME
// validator the mandatory gate uses (so a clean +852 number can't be overwritten
// with junk), and writes via service-role rather than a client .update() that
// silently fails when RLS blocks self-updates. Email is read-only in Settings,
// so it's intentionally not editable here.
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    const result = validateNamePhone({ name: body?.name, phone: body?.phone })
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, field: result.field },
        { status: 422 },
      )
    }

    const service = getServiceSupabase()
    const { error } = await service
      .from('users')
      .update({
        display_name: result.value.display_name,
        phone: result.value.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) {
      console.error('profile_update_error', error.message)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: result.value })
  } catch (err) {
    console.error('profile_update_error', (err as Error).message)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
