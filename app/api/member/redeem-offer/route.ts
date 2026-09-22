import { NextResponse } from 'next/server'
import { redeemOfferWithPoints } from '@/lib/data/getMemberRedesign'

export async function POST(req: Request) {
  try {
    const { offerId } = await req.json()

    if (!offerId) {
      return NextResponse.json({ error: 'offer_id_required' }, { status: 400 })
    }

    const result = await redeemOfferWithPoints(offerId)

    if (result.success) {
      return NextResponse.json({ success: true, new_balance: result.new_balance })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('[redeem-offer] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
