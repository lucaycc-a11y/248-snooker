# Changelog

All notable changes to Space8 web are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
