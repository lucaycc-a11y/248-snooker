import { NextResponse } from 'next/server'
import { loadPeriods } from '@/lib/booking/server'
import { getBookingCutoffMinutes, getActivePricingV2 } from '@/lib/pricing-v2'

// Session-aware pricing for the /book UI: periods already carry comboRate when
// pricing v2 applies to this caller (admin before go-live, everyone after), plus
// the matching booking cutoff. Never cached — the answer depends on the viewer
// and on the clock.
export const dynamic = 'force-dynamic'

export async function GET() {
  const [periods, cutoffMinutes, v2] = await Promise.all([
    loadPeriods(),
    getBookingCutoffMinutes(),
    getActivePricingV2(),
  ])
  return NextResponse.json(
    { periods, cutoffMinutes, v2Active: v2 != null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
