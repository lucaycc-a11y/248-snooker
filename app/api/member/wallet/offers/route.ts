import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/member/wallet/offers
// Returns eligible and used promo codes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteHandlerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all active promo codes
    const { data: eligibleCodes, error: codesError } = await supabase
      .from('promo_codes')
      .select('code, discount_type, discount_value, min_order_cents, expiry, usage_limit, usage_count')
      .eq('active', true)
      .or(`expiry.is.null,expiry.gte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (codesError) {
      console.error('[wallet/offers] promo codes fetch error:', codesError)
      return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 })
    }

    // Fetch used promo codes by this user
    const { data: usedCodes, error: usedError } = await supabase
      .from('promo_usage')
      .select('code, used_at')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })

    if (usedError) {
      console.error('[wallet/offers] used codes fetch error:', usedError)
      return NextResponse.json({ error: 'Failed to fetch used codes' }, { status: 500 })
    }

    const usedSet = new Set((usedCodes ?? []).map(u => u.code))

    const eligible = (eligibleCodes ?? []).filter(code => {
      if (usedSet.has(code.code)) return false
      if (code.usage_limit && code.usage_count >= code.usage_limit) return false
      return true
    })

    const used = (usedCodes ?? []).map(u => ({
      code: u.code,
      usedAt: u.used_at,
    }))

    return NextResponse.json({
      eligible,
      used,
    })
  } catch (err) {
    console.error('[wallet/offers] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
