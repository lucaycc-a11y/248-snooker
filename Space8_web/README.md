# 248 Snooker Club

Booking, membership, and door-access platform for 248 Snooker Club
(`space8.com.hk`).

## Stack

- **Framework**: Next.js 14 (App Router), TypeScript (strict — no `any`, use
  `unknown` + type guards), Tailwind, Framer Motion
- **Backend**: Supabase (Postgres + Auth + Storage)
- **Payments**: Stripe (Payment Element + webhooks)
- **Email**: Resend
- **i18n**: next-intl — 4 locales: `zh-HK` (default), `zh-CN`, `en`, `ja`
- **Structure**: everything lives at the repo root (`app/`, `components/`,
  `lib/`) — there is **no** `src/` directory

## Prerequisites

- Node.js 20+ (see `package.json` for any future `engines` pin)
- npm (this repo uses `package-lock.json`, not pnpm/yarn)
- A Supabase project (schema + RPCs live in `supabase/migrations/`)
- A Stripe account (test mode is fine for local dev)
- A Resend account (only needed to actually send email — the app degrades
  gracefully without it in most flows)

## 1. Install dependencies

```bash
npm install
```

## 2. Environment variables

Create `.env.local` in the repo root. These are the variables the app reads
(names only — get actual values from your own Supabase/Stripe/Resend
dashboards, or from Vercel → Project → Settings → Environment Variables if
you have access to the team's project):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never expose to the client

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=          # from `stripe listen` locally, see below

# Resend (email)
RESEND_API_KEY=
FROM_EMAIL=

# Auth / security
JWT_SECRET=                     # door QR signing, see lib/qr/jwt.ts
GATE_COOKIE_SECRET=              # coming-soon/site-gate cookie signing

# Misc
NEXT_PUBLIC_SITE_URL=            # e.g. http://localhost:3000 for local dev
VECTORENGINE_API_KEY=
VECTORENGINE_BASE_URL=
```

> Never hardcode price/booking-time/tier logic anywhere in the app — it must
> come from the `config` table (see `CLAUDE.md`).

## 3. Database setup

The `bookings` table (and a few others) predate this repo's migration
history — there is no single `CREATE TABLE` to run from scratch. To stand up
a new Supabase project:

1. Create the project in Supabase.
2. Run every file in `supabase/migrations/` **in filename order** via the
   Supabase SQL Editor (numbered migrations first, e.g. `0001_...` through
   `0033_...`, then the dated ones, e.g. `20260710_...`).
3. If you ever see a Postgres error like `column "..." does not exist` in
   production logs, it usually means a migration that assumes a column exists
   was written before the column itself was ever added in a tracked
   migration (this has happened before — see
   `0033_add_missing_booking_reference_column.sql`). Check
   `supabase/migrations/` for the fix or add one following the same
   `ADD COLUMN IF NOT EXISTS` pattern.

## 4. Stripe webhook (local dev)

Use the Stripe CLI to forward webhook events to your local server:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET` in
`.env.local`.

## 5. Run the dev server

```bash
npm run dev
```

Or, to only see booking/payment/webhook/profile-related logs plus errors:

```bash
npm run dev:debug
```

Visit `http://localhost:3000`.

## 6. CMS text sync

All user-visible text must go through `CMSText`/`next-intl`, keyed for CMS
sync — never hardcode user-facing strings. After adding or changing any
visible text:

```bash
npm run cms:sync
```

Other CMS scripts: `npm run cms:audit` (find un-synced strings), `npm run
cms:seed` (seed CMS rows from the `messages/*.json` files).

## 7. Testing

There's no local `.env` with real credentials in most dev setups by
default — live payment and concurrency tests generally require an actual
Supabase project + Stripe test keys wired up first. Browser/E2E testing uses
Playwright — see `.agents/skills/webapp-testing` if installed.

## Project conventions (see `CLAUDE.md` for the full list)

- Files: kebab-case. Components: PascalCase. Hooks: `use*` prefix.
- All server-side Supabase clients must use
  `createRouteHandlerClient({ cookies })` — never a bare anon-key
  `createClient()` (this has caused silent 401s before).
- Price/booking-time/tier logic lives only in the `config` table.

## Deployment

See `DEPLOYMENT_GUIDE.md`. Production runs on Vercel
(`lucaycc-3022s-projects/space8`, serving `space8.com.hk`).
