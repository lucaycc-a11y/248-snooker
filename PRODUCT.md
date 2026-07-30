# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 14 App Router, TypeScript strict, Tailwind CSS, Framer Motion, Supabase (Postgres + Auth + Storage), Stripe, Resend, next-intl (4 locales: zh-HK default, zh-CN, en, ja)

## Users

- **Casual / walk-in players:** first-time or infrequent visitors who want to book a table for a session — frictionless booking, clear pricing, and venue info are the core needs.
- **Regular / returning players:** frequent bookers who may consider membership. Quick rebooking, account management, and loyalty/perks matter.
- **Both segments** are equally important. The site serves both as a first-impression marketing tool and a reliable rebooking hub.

## Product Purpose

Space8 is a self-service Chinese 8-ball (中式八球/中八) snooker club in Hong Kong. The website enables online booking, QR-code self-check-in, and membership management. The physical venue is a smoke-free, private-room snooker space in San Po Kong (新蒲崗), near Diamond Hill and Kai Tak MTR stations.

## Positioning

Hong Kong's first self-service Chinese snooker club. Distinguishing factors:
- Fully automated (online booking → Apple Pay → QR code entry — no staff needed)
- Smoke-free independent rooms (not a traditional smoky pool hall)
- Chinese 8-ball focus (中八, not English snooker or American pool)
- Operating hours 06:00–24:00 daily

## Operating Context

- Visitors discover the site via Google search (local SEO), Instagram, Word-of-mouth
- Primary booking flow: browse venue → select time slot → pay (Stripe/Apple Pay) → receive QR code → scan at door
- Mobile-first: most bookings happen on phone
- 4 locales: zh-HK (default, no prefix), zh-CN, en, ja

## Capabilities and Constraints

- **Confirmed:** booking flow, Stripe payment, QR check-in, venue gallery, pricing display, membership tiers, CMS-driven text via next-intl, blog, FAQ, directions
- **Technical constraints:** No `any` types (use `unknown` + type guards), all server-side Supabase clients use `createRouteHandlerClient({ cookies })`, pricing/booking-time/tier logic lives only in `config` table, CMS text uses `data-cms-key` attributes
- Space8 has its own defined design system (green/black palette, custom easing curves, glass-panel surfaces) — these are intentional, not defaults

## Brand Commitments

- **Name:** SPACE8 (stylized uppercase)
- **Colors:** Black (`#000000`), brand green (`#25D366` → `#1A6B35`), dark surfaces (`#111111`, `#1A1A1A`)
- **Typography:** Bebas Neue for display headings, system SF Pro for body
- **Voice:** Modern, premium, minimal, direct — Hong Kong urban aesthetic
- **Visual identity:** Dark-first, glass-morphism (blur/saturate panels), green accent for CTAs, generous whitespace, full-bleed media
- **Logo & assets:** Favicon set in `/public/favicon/`, OG image at `/og-image.png`, gallery in `/public/gallery/`, brand fonts in `/public/fonts/`

## Evidence on Hand

- Live site: space8.com.hk
- Full gallery of venue photos in `/public/gallery/`
- Video assets in `/public/video/`
- Blog content in `lib/blog/`
- Real pricing data from Supabase `config` table
- 4-language message bundles in `messages/`

## Product Principles

1. **Mobile-first, thumb-friendly** — most bookings happen on a phone one-handed; primary actions must live in the bottom third of the viewport.
2. **Frictionless booking** — the core transaction (browse → book → pay → enter) should be the shortest path from intent to QR code.
3. **Dark-first, not inverted** — the black/green palette is a deliberate brand identity, not a theme toggle; every surface is designed for dark from the start.
4. **Premium minimalism** — generous whitespace, glass surfaces, intentional motion. No clutter, no generic stock patterns.
5. **Trust through transparency** — clear pricing, no hidden fees, real venue photos, straightforward cancellation policy.

## Accessibility & Inclusion

- 4-language support (zh-HK, zh-CN, en, ja)
- Reduced-motion support via `prefers-reduced-motion`
- Dark theme as default (not a high-contrast afterthought)
- 48px minimum tap targets on interactive elements