---
name: Booking Flow
description: Use when working on any booking-related page, component, API route, or database query for the 248 booking system.
---

# 248 Booking Flow Skill

## User Journey
1. /book — Select date + period + duration (components/booking: DateStrip, SlotList, SlotRow, DurationSheet)
2. /book/confirm — Review (BookingSummary) + login if needed
3. /book/checkout — Apple Pay / Stripe payment
   (QR + confirmation shown after successful payment)

## Pricing Logic (server-side only)
Rates live in the `config` table (`pricing.periods`) — lib/pricing.calculatePrice()
is the single source of truth. Current rate card (2026, all days):
```ts
// morning   06:00–12:00  $88/h  ($78/h when contiguous block >= 2h)
// afternoon 12:00–16:00  $98/h  ($88/h when contiguous block >= 2h)
// evening   16:00–24:00  $108/h (no multi-hour discount)
```
The 2h+ discount (`rateFrom2h`) applies per contiguous block, never across a
whole multi-block order. Never hardcode these numbers in components.

## Session Storage Schema
```ts
interface BookingSelection {
  // per-date selection of individual (table, hour) slots — 'T:H' keys,
  // e.g. '1:9' = Table 1, 09:00. Mixed-table orders are allowed.
  entries: Array<{ date: string /* YYYY-MM-DD */; slots: string[] }>
  updatedAt: number
}
```
Key: 'bookingSelection' (durable) / 'pendingBooking' (one-shot, auth redirect)

## API Routes (app/api)
- app/api/slots        → available time slots
- app/api/bookings/lock    → reserve slot before payment
- app/api/bookings/confirm → confirm after payment
- app/api/bookings/cancel  → cancel / release
- app/api/qr           → QR generation/validation
- app/api/webhooks     → Stripe webhook handler
- app/api/points       → member points
- app/api/door         → ESP32 door access

## Slot Locking
- Call bookings/lock before payment to reserve slot
- Releases after timeout if payment incomplete
- Prevents race conditions (DB-level lock)

## Stripe Flow
1. Client → app/api/bookings/lock (validates price server-side, reserves slot)
2. Server creates PaymentIntent, returns client_secret
3. Client confirms payment (Apple Pay / card)
4. Stripe webhook (app/api/webhooks) → app/api/bookings/confirm
5. Resend email (lib/resend) + QR code generation (lib/qr)

## QR Code Generation
```ts
import jwt from 'jsonwebtoken'
const qrPayload = { bookingId, userId, expiresAt }
const token = jwt.sign(qrPayload, process.env.QR_SECRET)
// Human-readable: 248-XXXXXXXX-XXXX-XX
```

## Member Tiers
```ts
const TIERS = {
  amateur: { pts: 0,    discount: 1.0, multiplier: 1 },
  century: { pts: 500,  discount: 0.9, multiplier: 1.5 },
  maximum: { pts: 1500, discount: 0.8, multiplier: 2 },
}
// New users start with 50 points (Endowed Progress effect)
```

## UX Rules
- Session preserved across Google/Apple auth redirect
- No countdown timers (causes anxiety)
- Show today's available slots auto-highlighted
- Returning users: 2 taps + Face ID = ~15 seconds
- Peak-End Rule: success state has particle animation
