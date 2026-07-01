# Debugging the booking → payment flow

## Structured logs

`booking/lock`, `payment/create-intent`, `webhooks/stripe`, and
`profile/complete` all log a consistent `[route] step` line per key step
(`attempt` / `success` / `rejected`) plus `console.error` with the full
error object (message, code/type, ids) on failure — never just
`error.message`.

Run `npm run dev:debug` instead of `npm run dev` to see only these lines
(and anything logged as `ERROR`), filtered out of Next.js's compile/HMR
noise. Run a full booking → payment attempt and the terminal shows each
stage in order:

```
[booking/lock] attempt { userId, tableNumber, date, startHour, duration }
[booking/lock] success { userId, slotId, lockedUntil }
[payment/create-intent] attempt { userId, slotId }
[payment/create-intent] success { userId, bookingId, paymentIntentId, amount }
[webhook/stripe] received { eventId, type }
[webhook/stripe] confirming booking { bookingId, userId, paymentIntentId, paymentMethod, amount }
[webhook/stripe] booking confirmed { bookingId, userId, bookingReference }
[webhook/stripe] success { eventId, type }
```

If it stops partway through, that's the stage to investigate.

## Local Stripe webhook forwarding

Vercel/Stripe webhooks don't reach `localhost`, so local testing needs the
Stripe CLI to forward events:

1. Install: `brew install stripe/stripe-cli/stripe`
2. Log in: `stripe login`
3. In a dedicated terminal, forward events to your local dev server:
   ```
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   This prints a `whsec_...` — set it as `STRIPE_WEBHOOK_SECRET` in
   `.env.local` for local runs (it's different from the production
   webhook secret). The terminal also prints the full payload + headers of
   every event as it arrives, so there's no need to guess what Stripe sent.
4. In another terminal, fire a test event on demand:
   ```
   stripe trigger payment_intent.succeeded
   ```

## Two-terminal workflow

- Terminal A: `npm run dev:debug` — filtered booking/payment/webhook logs
- Terminal B: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

Run the booking flow in the browser and watch both terminals for the full
lock → payment intent → webhook chain.
