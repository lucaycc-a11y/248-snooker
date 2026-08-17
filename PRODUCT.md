# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** Casual and regular cue-sports players in Hong Kong. They want to play Chinese eight-ball (中八) in a clean, smoke-free, private room — book online in minutes, show up, scan a QR code, and play. No phone calls, no walk-in uncertainty, no smoky hall.

**Secondary:** Members who book frequently, accumulate points, and unlock tiered benefits. They use the member dashboard to view booking history, manage settings, and access QR codes.

**Tertiary:** Admin/staff who manage bookings, pricing, promotions, members, door access, blog content, and media assets.

## Product Purpose

SPACE8 is a reservation-based, self-service Chinese eight-ball club in San Po Kong, Hong Kong. It lets players book a private snooker room online, check in via QR code, and play without any staff interaction. The platform handles the full lifecycle: discovery, booking, payment, door access, membership, and admin operations.

## Positioning

SPACE8 is the only Chinese eight-ball venue in Hong Kong that combines **self-service automation** (no staff, online booking, QR entry), a **premium smoke-free environment**, **private independent rooms** (not an open hall), and **convenient online booking** in a sport that traditionally relies on walk-in and phone calls. It is the "iPhone of snooker clubs" — frictionless, automated, premium.

## Operating Context

- Players browse on mobile (primary) or desktop, select a date/time/table, pay via Stripe, and receive a QR code.
- At the venue, players scan the QR code at the door to unlock their room.
- Members earn 1 point per HK$1 spent, with automatic tier progression (Amateur → Century → Maximum).
- Booking confirmations and receipts are sent via email (Resend).
- The venue is in San Po Kong, near Diamond Hill and Kai Tak MTR stations.
- The club is fully automated — no staff on site, 24/7 operation model.

## Capabilities and Constraints

- **Booking:** Select date/time/table, see pricing, book with Stripe payment (cards, mobile wallets). Promo codes supported.
- **Membership:** Points-based tier system (Amateur, Century, Maximum) with automatic upgrades. Member dashboard for history, settings, QR codes.
- **Authentication:** Phone-based OTP (SMS), Apple/Google OAuth via Supabase Auth.
- **Payments:** Stripe Payment Element, webhooks for async confirmation, receipt emails.
- **Door access:** QR code generation and verification for self-service entry.
- **Admin:** Booking management, member management, pricing configuration, promo codes, blog/media, AI settings, door lock control, site gate.
- **i18n:** 4 locales — zh-HK (default), zh-CN, en, ja.
- **CMS:** All user-visible text goes through `CMSText`/`next-intl` keyed for CMS sync. Run `npm run cms:sync` after text changes.
- **Constraint:** Price/booking-time/tier logic lives only in the `config` table — never hardcoded.
- **Constraint:** No `any` types — use `unknown` + type guards.
- **Constraint:** Server-side Supabase clients must use `createRouteHandlerClient({ cookies })`.

## Brand Commitments

- **Name:** SPACE8 (also 248 Snooker Club). "Space8" is the primary brand.
- **Tagline:** 屬於你的空間 ("Your Space")
- **Logo:** SVG-based "SPACE8" wordmark with an 8-ball icon. White variant for dark backgrounds, black variant for light. Available in horizontal (full lockup) and mark-only variants.
- **Colors:** Black background (`#000000`), brand green (`#25D366` / `#22C55E` / `#1A6B35`), white text, dark surfaces (`#111111`, `#1A1A1A`). Apple-inspired dark design language.
- **Typography:** System font stack (SF Pro Display), Bebas Neue for display/headline use.
- **Voice:** Modern, premium, minimal — Hong Kong local with international polish. Bilingual (Chinese + English).
- **Brand guideline:** Minimum logo width 120px digital. Never redraw the 8-ball in code.
- **Assets:** `/logos/` directory with SVG exports. Hero video assets pending from Luca.

## Evidence on Hand

- Full production codebase (Next.js 14, TypeScript, Tailwind, Framer Motion).
- 4 locales of translation files in `messages/`.
- SVG logo assets in `/public/logos/`.
- Hero poster image and video at `/video/`.
- Supabase project with `config` table-driven pricing.
- Stripe integration with webhook handling and decline code mapping.
- Resend email integration for booking receipts.
- WhatsApp support fallback configured.

## Product Principles

1. **Automation first.** Every manual step that can be eliminated (phone calls, walk-in, staff check-in, paper receipts) should be eliminated. The platform is the staff.
2. **Mobile-native.** The primary booking device is a phone. Every flow must be fast, thumb-friendly, and work on a small screen before it's optimized for desktop.
3. **Premium with zero friction.** The brand is premium (dark, green, minimal) but the experience requires zero learning. No onboarding tour, no training — just book, scan, play.
4. **One source of truth.** Pricing, tier thresholds, and time logic live in the database, not in code. The config table is the single source for every business rule.
5. **Local first, global ready.** Built for Hong Kong players (zh-HK primary) but fully internationalized for visitors from China, Japan, and English-speaking markets.

## Accessibility & Inclusion

- Dark theme by default (reduced glare in a dimly lit venue context).
- System font stack respects user font settings.
- Phone-based auth lowers barriers for users without email or social logins.
- Not explicitly tested against WCAG; follow platform best practices.