import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// RETIRED — do not reinstate.
//
// This route derived the charge amount from `config.hourly_rate`, a column that
// does not exist: `config` is a key/value jsonb table (key text PRIMARY KEY,
// value jsonb), so the select failed, `config` came back null, and
// `config?.hourly_rate || 100` silently billed HK$100/hour. A HK$5 booking was
// charged HK$100 through this path. It also bypassed slot-lock validation,
// prepare_checkout discount reservation, and the tier/period pricing engine.
//
// The single supported path is POST /api/payment/create-intent, which re-derives
// the price server-side via calculatePrice() from the `config` pricing periods
// and reserves discounts through prepare_checkout.
export async function POST() {
  return NextResponse.json(
    {
      error: 'route_retired',
      detail: 'Use POST /api/payment/create-intent',
    },
    { status: 410 },
  )
}
