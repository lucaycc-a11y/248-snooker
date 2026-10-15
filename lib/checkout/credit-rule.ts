// Client-side mirror of the credit step in the prepare_checkout RPC. The RPC is the
// authority; this exists so the total shown at checkout (and sent as expectedTotal)
// matches what the server will charge. Keep the two in sync.
//
// Order: promo discount first, then Space Wallet credit on what is left.
// A card payment must be HK$0 (fully covered) or at least HK$10, so if the credit
// would leave HK$1-9 to pay, HK$10 less credit is used.

export const MIN_CARD_PAYMENT = 10

export function creditToApply(args: {
  subtotal: number
  promoDiscount: number
  balance: number
}): number {
  const net = args.subtotal - args.promoDiscount
  if (net <= 0 || args.balance <= 0) return 0
  let credit = Math.floor(Math.min(args.balance, net))
  const remaining = net - credit
  if (remaining >= 1 && remaining < MIN_CARD_PAYMENT) credit -= MIN_CARD_PAYMENT
  return credit > 0 ? credit : 0
}
