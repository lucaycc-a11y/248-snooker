import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase/service'

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

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .rpc('validate_promotion_code', {
        p_code: code,
        p_cart_amount: cartAmount,
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