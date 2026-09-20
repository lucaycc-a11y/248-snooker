# Changelog

All notable changes to Space8 web are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [3.12.8-uat.3] - 2026-09-21

### Fixed
- **/maintenance page**: Added missing `maintenance` namespace to all three locale files (zh-HK, zh-CN, en) — page was rendering raw translation keys (`maintenance.title`, `maintenance.subtitle`, etc.) instead of text whenever maintenance mode was enabled.

### Changed
- **scripts/check-i18n-keys.js**: Extended i18n validation to detect missing namespaces and duplicate keys within JSON objects. The script now scans source code for `useTranslations('X')` and `getTranslations('X')` calls and fails the build if any referenced namespace is missing from locale files, preventing this class of bug from shipping.

## [3.12.8-uat.2] - 2026-09-21

### Fixed
- **Stripe payment flow (create-intent/route.ts)**: Add missing `is_test` flag to booking inserts — Stripe bookings were never marked as test, causing UAT bookings to pollute production availability queries and revenue statistics.
- **KPay payment flow (checkout/create/route.ts)**: Refactor `is_test` logic to use shared fail-safe helper instead of inline `isUatEnv()` check.

### Added
- **lib/env/test-booking.ts**: Shared fail-safe test-booking detection helper. Production hostnames (`space8.com.hk`, `www.space8.com.hk`) always return `false` (never test), even if `VERCEL_ENV` is misconfigured. Non-production runtime detection uses explicit allowlist (`VERCEL_ENV ∈ {preview, development}` or `NODE_ENV=development`) instead of unsafe `!== 'production'` check. Unknown/missing environment variables default to `false` (production) for safety, since `is_test` also gates `applyTestPriceOverride` — a false positive on production means real customers pay test prices.
- **lib/env/test-booking.test.ts**: 17 unit tests covering fail-safe logic, including critical case: `VERCEL_ENV=undefined` on production hostname correctly returns `false` (our implementation), not `true` (unsafe `!== 'production'` check).
- **tsconfig.json**: Exclude `**/*.spec.ts` and `**/*.e2e.ts` from TypeScript compilation (Playwright end-to-end tests have separate config).

### Security
- **Stripe key audit**: Confirmed Preview environment uses Stripe **live keys** (`pk_live_...`), same as Production. Combined with test-booking low prices (HK$1-5), Preview deployments charge real Stripe accounts with real cards at reduced amounts. Consider switching Preview to Stripe test-mode keys (`pk_test_...`, `sk_test_...`) to avoid charging real payment methods during internal testing.

## [3.12.8-uat.1] - 2026-09-20

### Fixed
- **book/page.tsx**: Restore full `renderCell` slot cell style block — `minHeight`, `padding`, `borderRadius`, three-branch `border` (selected/booked/default), `booked` background `rgba(255,69,58,0.08)`, and `past || locked` faint color. These were dropped during the `main → uat` merge.
- **Nav.tsx**: Replace inline luminance calculation with `resolveNavThemeFromElement` from `lib/nav-theme` — RGBA-aware ancestor-walk correctly ignores translucent surfaces instead of reading them as opaque.
- **MembershipContent.tsx**: Add `data-nav-theme="dark"` so the Nav detects the dark membership page without an ancestor walk.
- **lib/nav-theme.ts**: Add untracked utility file to git — was never committed despite being required by Nav.tsx.
- **messages/{en,zh-HK,zh-CN}.json**: Remove `coming_soon_label` from the `blog` namespace (merge artifact; correct root-level key is preserved). `node scripts/check-i18n-keys.js` now passes clean.

## [3.12.7] - 2026-09-20

### Changed
- Footer "Secured by" badge: replaced KPay logo with official Stripe white wordmark (`public/logos/stripe-logo.svg`). Stripe is the active payment processor; the badge now accurately reflects that.
