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
```ts
const PRICES = {
  afternoon: 60,  // 12pm-6pm
  evening: 80,    // 6pm-12am
  latenight: 60,  // 12am-6am
} as const

const total = PRICES[period] * duration
```

## Session Storage Schema
```ts
interface BookingSelection {
  date: string        // 'YYYY-MM-DD'
  period: 'afternoon' | 'evening' | 'latenight'
  startTime: string   // 'HH:MM'
  endTime: string
  duration: 1 | 2 | 3
  totalPrice: number  // server-verified
}
```
Key: 'bookingSelection'

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

## UX Rules
- Session preserved across Google/Apple auth redirect
- No countdown timers (causes anxiety)
- Show today's available slots auto-highlighted
- Returning users: 2 taps + Face ID = ~15 seconds
- Peak-End Rule: success state has particle animation
