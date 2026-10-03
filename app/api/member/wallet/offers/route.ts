import { getServiceSupabase } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'

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

    const serviceSupabase = getServiceSupabase()

    // Fetch all active promo codes (use service client to bypass RLS)
    const { data: codes, error: codesError } = await serviceSupabase
      .from('promotion_codes')
      .select('code, discount_type, discount_value, min_cart_amount, max_uses, name')
      .eq('is_active', true)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (codesError) {
      console.error('[wallet/offers] promo codes fetch error:', codesError)
      return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 })
    }

    // Fetch used promo codes by this user (join to get the actual code string)
    const { data: used, error: usedError } = await serviceSupabase
      .from('promo_code_usages')
      .select('redeemed_at, promo_code_id, promotion_codes!inner(code)')
      .eq('user_id', user.id)
      .not('redeemed_at', 'is', null)
      .order('redeemed_at', { ascending: false })

    if (usedError) {
      console.error('[wallet/offers] used codes fetch error:', usedError)
      return NextResponse.json({ error: 'Failed to fetch used codes' }, { status: 500 })
    }

    const usedSet = new Set(
      (used ?? []).map(u => {
        const promo = u.promotion_codes as unknown as { code: string } | { code: string }[]
        return Array.isArray(promo) ? promo[0]?.code : promo?.code
      }).filter(Boolean)
    )

    const eligible = (codes ?? []).filter(code => {
      if (usedSet.has(code.code)) return false
      return true
    })

    const usedFormatted = (used ?? []).map(u => {
      const promo = u.promotion_codes as unknown as { code: string } | { code: string }[]
      const code = Array.isArray(promo) ? promo[0]?.code : promo?.code
      return {
        code: code ?? '',
        usedAt: u.redeemed_at,
      }
    })

    return NextResponse.json({
      eligible,
      used: usedFormatted,
    })
  } catch (err) {
    console.error('[wallet/offers] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

