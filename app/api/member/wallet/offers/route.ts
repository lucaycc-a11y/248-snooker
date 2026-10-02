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

    // Fetch all active promo codes (fallback to empty if table doesn't exist)
    let eligibleCodes: unknown[] = []
    let usedCodes: unknown[] = []

    try {
      const { data: codes, error: codesError } = await supabase
        .from('promotion_codes')
        .select('code, discount_type, discount_value, min_order_cents, expiry, usage_limit, usage_count')
        .eq('active', true)
        .or(`expiry.is.null,expiry.gte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })

      if (codesError) {
        console.error('[wallet/offers] promo codes fetch error:', codesError)
      } else {
        eligibleCodes = codes ?? []
      }
    } catch (err) {
      console.error('[wallet/offers] promo codes fetch exception:', err)
    }

    // Fetch used promo codes by this user (fallback to empty if table doesn't exist)
    try {
      const { data: used, error: usedError } = await supabase
        .from('promo_code_usages')
        .select('code, redeemed_at')
        .eq('user_id', user.id)
        .order('redeemed_at', { ascending: false })

      if (usedError) {
        console.error('[wallet/offers] used codes fetch error:', usedError)
      } else {
        usedCodes = used ?? []
      }
    } catch (err) {
      console.error('[wallet/offers] used codes fetch exception:', err)
    }

    const usedSet = new Set((usedCodes ?? []).map((u: any) => u.code))

    const eligible = (eligibleCodes ?? []).filter((code: any) => {
      if (usedSet.has(code.code)) return false
      if (code.usage_limit && code.usage_count >= code.usage_limit) return false
      return true
    })

    const used = (usedCodes ?? []).map((u: any) => ({
      code: u.code,
      usedAt: u.redeemed_at,
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

