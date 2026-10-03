import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/route-handler'
import type { WalletOffersResponse, OfferAvailable, OfferUsed } from '@/lib/member-contracts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createRouteHandlerClient()

  // Auth check
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const userId = session.user.id
  const now = new Date().toISOString()

  try {
    // Fetch available promo codes
    const { data: availableCodes, error: availableError } = await supabase
      .from('promotion_codes')
      .select('code, name, discount_type, discount_value, min_cart_amount, max_discount, valid_until')
      .eq('is_active', true)
      .or(`valid_until.is.null,valid_until.gte.${now}`)

    if (availableError) {
      throw new Error('Failed to fetch available offers')
    }

    const available: OfferAvailable[] =
      availableCodes?.map((code: any) => ({
        code: code.code,
        name: code.name,
        discountType: code.discount_type,
        discountValue: code.discount_value,
        minCartAmount: code.min_cart_amount,
        maxDiscount: code.max_discount,
        validUntil: code.valid_until,
      })) ?? []

    // Fetch used promo codes for this user
    const { data: usedCodes, error: usedError } = await supabase
      .from('promo_code_usages')
      .select('code, discount_amount, redeemed_at, promotion_codes(name)')
      .eq('user_id', userId)
      .eq('status', 'redeemed')
      .order('redeemed_at', { ascending: false })
      .limit(50)

    if (usedError) {
      throw new Error('Failed to fetch used offers')
    }

    const used: OfferUsed[] =
      usedCodes?.map((usage: any) => ({
        code: usage.code,
        name: (usage.promotion_codes as any)?.name ?? usage.code,
        discountAmount: usage.discount_amount,
        redeemedAt: usage.redeemed_at,
      })) ?? []

    const response: WalletOffersResponse = {
      available,
      used,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Wallet offers API error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
