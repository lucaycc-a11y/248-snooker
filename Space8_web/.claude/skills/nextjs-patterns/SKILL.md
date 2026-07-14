---
name: Next.js 14 Patterns
description: Use when creating pages, API routes, components, or any Next.js code for the 248 project.
---

# Next.js 14 App Router Patterns

## File Structure (repo root — NO src/ dir)
```
app/
  page.tsx              ← homepage
  book/page.tsx         ← booking step 1 (select)
  book/confirm/page.tsx ← booking step 2 (review + auth)
  book/checkout/page.tsx← booking step 3 (payment)
  pricing/page.tsx
  about/page.tsx
  faq/page.tsx
  member/               ← member dashboard
  admin/                ← admin area
  auth/                 ← auth callbacks
  maintenance/
  api/                  ← route handlers (see below)
components/
  landing/              ← homepage sections (Hero, Pricing, FAQ, ...)
  layout/               ← Nav, Footer
  booking/              ← BookingSummary, DateStrip, DurationSheet, SlotList, SlotRow
  checkout/  confirm/  member/  admin/  auth/
  shared/               ← reusable components
  ui/                   ← primitive components
lib/
  ai/  cms/  qr/  resend/  stripe/  supabase/  twilio/

api/ route groups:
  bookings/{lock,confirm,cancel}  qr  slots  webhooks
  cms  points  door  media  notifications  ai
```

## Server vs Client
- Default: Server Components
- Use 'use client' only when: useState, useEffect, event handlers, framer-motion
- Data fetching in Server Components via Supabase server client (lib/supabase)
- Mutations via API routes (app/api) or Server Actions

## Metadata (every page)
```ts
export const metadata = {
  title: 'Page Title | 248 桌球會',
  description: '...',
  openGraph: { ... }
}
```

## CMS Pattern
- All content from cms_content table (lib/cms, app/api/cms)
- Server: getCMS(page, key)
- Client: useCMS(page, key)
- Fallback to hardcoded default if DB empty
- All JSX text: <span data-cms-key="key">{content}</span>

## Performance
- Images: next/image with priority on above-fold
- Fonts: next/font for Bebas Neue
- Lazy load below-fold sections
- No layout shift (define width/height on images)
