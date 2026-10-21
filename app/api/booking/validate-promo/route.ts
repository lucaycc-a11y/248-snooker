import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

export const runtime = 'nodejs'

// POST /api/booking/validate-promo
// Validates a promotion code server-side. Returns discount info if valid.
// Never trusts the client — even if the client sends a code, we re-validate here.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const code = body?.code?.trim()
    const cartAmount = typeof body?.cartAmount === 'number' ? body.cartAmount : 0

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, reason: 'missing_code' }, { status: 400 })
    }

    // Who is asking matters: per-member limits and audience rules (e.g. new
    // users only) are checked against the signed-in member's history.
    const authClient = await createRouteHandlerClient()
    const { data: { user } } = await authClient.auth.getUser()

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .rpc('validate_promotion_code', {
        p_code: code,
        p_cart_amount: cartAmount,
        p_user_id: user?.id ?? null,
      })

    if (error) {
      console.error('[validate-promo] rpc error', error)
      return NextResponse.json({ valid: false, reason: 'validation_error' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[validate-promo] crash', err)
    return NextResponse.json({ valid: false, reason: 'internal_error' }, { status: 500 })
  }
}