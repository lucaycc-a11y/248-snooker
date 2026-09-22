import { NextResponse } from 'next/server'
import { redeemOfferWithPoints } from '@/lib/data/getMemberRedesign'

export async function POST(req: Request) {
  try {
    const { offerId, pointsCost } = await req.json()

    if (!offerId || !pointsCost) {
      return NextResponse.json({ error: 'offer_id_and_points_required' }, { status: 400 })
    }

    const result = await redeemOfferWithPoints(offerId, pointsCost)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
  } catch (error) {
    console.error('[redeem-offer] Error:', error)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
