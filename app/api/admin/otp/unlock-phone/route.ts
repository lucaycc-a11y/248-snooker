import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { normalizeHkPhone } from '@/lib/auth/profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { phone?: unknown }

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ code: 'AUTH_REQUIRED', requestId }, { status: 401 })
    const body = await request.json().catch(() => null) as Body | null
    const phone = normalizeHkPhone(typeof body?.phone === 'string' ? body.phone : '')
    if (!phone) return NextResponse.json({ code: 'PHONE_INVALID', requestId }, { status: 422 })
    const service = getServiceSupabase()
    const { data, error } = await service.rpc('admin_unlock_phone', { p_phone: phone }).maybeSingle()
    if (error) {
      const status = error.code === '42501' ? 403 : 500
      console.error(JSON.stringify({ event: 'admin.otp.unlock.failed', requestId, error: error.message, code: error.code }))
      return NextResponse.json({ code: status === 403 ? 'SUPER_ADMIN_REQUIRED' : 'OTP_INTERNAL', requestId }, { status })
    }
    return NextResponse.json({ ok: true, requestId, unlockedEvents: (data as { unlocked_events?: number } | null)?.unlocked_events ?? 0 })
  } catch (error: unknown) {
    console.error(JSON.stringify({ event: 'admin.otp.unlock.error', requestId, error: error instanceof Error ? error.message : String(error) }))
    return NextResponse.json({ code: 'OTP_INTERNAL', requestId }, { status: 500 })
  }
}
