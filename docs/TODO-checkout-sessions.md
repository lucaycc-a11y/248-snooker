# TODO: evaluate migrating to Stripe Checkout Sessions API

**Status:** not started. Recorded per Stripe Dashboard's own deprecation-style
warning on the current integration; not in scope for the Payment Element UX
round that added this note.

## What we have now

`components/checkout/StripePayment.tsx` uses the Elements/Payment Element
integration: `app/api/payment/create-intent` creates a `PaymentIntent`
server-side, the client renders `<PaymentElement>` inside `<Elements
clientSecret={...}>`, and confirms with `stripe.confirmPayment()`.

## What Stripe recommends instead

The Checkout Sessions API (`stripe.checkout.sessions.create()` +
redirect-to-Stripe-hosted-page, or the embedded Checkout variant) is Stripe's
current recommended integration: less client code to maintain, Stripe owns
more of the compliance/PCI surface, and it's the integration path Stripe is
steering toward for newer features (including AI-agent-driven checkout flows).

## Why this isn't a quick swap

This is a full checkout-flow rewrite, not a config change:
- The current flow locks the slot, creates the booking row, and creates the
  PaymentIntent all before rendering payment UI (`app/api/booking/lock` →
  `app/api/payment/create-intent`) — Checkout Sessions has its own
  success_url/cancel_url redirect model that would restructure this sequence.
- `app/api/webhooks/stripe/route.ts` listens for `payment_intent.*` events;
  Checkout Sessions introduces `checkout.session.completed` as the primary
  event, so the webhook handler's dispatch logic would need rework.
- The countdown/lock-hold UI, the appearance theming (`rules` for `.Tab`,
  `.Input`, etc.), and the billing-details prefill all assume the embedded
  Payment Element — Stripe-hosted Checkout has a different (more limited)
  customization surface.

## Suggested next step (when picked up)

Time-box a spike against Stripe's embedded Checkout (not the hosted redirect
page, to keep the current on-page black/green design) before committing to a
full migration, and compare against just keeping Elements — Stripe hasn't
announced an end-of-life date for the Payment Element integration as of this
note.
