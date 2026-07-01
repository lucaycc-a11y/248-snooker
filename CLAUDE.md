# CLAUDE.md

## Stack
- Next.js 14 App Router, TypeScript strict, Tailwind
- Supabase (Postgres + Auth + Storage), Stripe, Resend
- next-intl (4 locales: zh-HK default, zh-CN, en, ja)

## Constraints
- Never use `any`. Use `unknown` + type guards.
- Price/booking-time/tier logic lives only in `config` table — never hardcode.
- All server-side Supabase clients must use `createRouteHandlerClient({ cookies })`,
  never a bare anon-key `createClient()` — this has caused silent 401s before.
- CMS text uses `data-cms-key` attributes — never hardcode user-facing strings.

## Naming
- Files: kebab-case. Components: PascalCase. Hooks: use* prefix.

## Working style
- Follow the `karpathy-guidelines` and `efficient-engineering` skills for every
  non-trivial task, without being asked.
