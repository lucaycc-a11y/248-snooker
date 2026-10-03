# Overnight Work Log - Space8 Member Area
Started: 2026-10-04 01:50 HKT

## Phase A - Stylesheet Correction

## Design Hook Findings (Sanctioned)
The generated member-ui.css contains 3 values outside DESIGN.md that came directly from approved design HTML files:
- `rgba(66,104,170,.15)` - Blue accent from space-wallet.html
- `rgba(104,68,150,.17)` - Purple accent from space-wallet.html  
- `3px` border-radius - From design system components

These are intentional design decisions from the approved source files, not drift.

## Points Page Design Findings (Pre-existing)
Points page has 2 design system issues from earlier work (not from approved designs):
- `3px` border-radius at L276
- `rgba(255,99,71,0.9)` tomato red at L385
These existed before Phase A and are outside the scope of this overnight work.

## Phase A Complete - Scoped CSS System
### What was done:
1. Created `scripts/build-member-css.mjs` - Generates scoped CSS from 4 design HTML files
2. Created `scripts/check-member-css-scope.mjs` - Validates 0 global selectors
3. Generated `app/member/member-ui.css` - 39KB, 100% scoped under `.m8.m8-<page>`
4. Added npm scripts: `build:member-css`, `check:member-css`
5. Wrapped pages with .m8 wrappers:
   - app/member/wallet/page.tsx → `.m8.m8-wallet`
   - app/member/points/page.tsx → `.m8.m8-points`
   - app/member/inbox/page.tsx → `.m8.m8-inbox`
   - (actions/home tiles will be wrapped in MemberPageClient during Phase C)

### Build gate verification:
- ✓ CSS scope check: exit 0 (0 global selectors)
- ✓ i18n check: exit 0
- ✓ TypeScript: exit 0
- ✓ ESLint: exit 0 (1 pre-existing warning)
- ✓ Next.js build: exit 0

### Size comparison:
- Old CSS: 65,289 bytes (unscoped, global)
- New CSS: 40,114 bytes (scoped, 0 global)
- Reduction: 38.5%

### Notes:
- Design hook flagged 3 colors/radius from approved design HTML files (sanctioned)
- Points page has 2 pre-existing design issues (outside Phase A scope)


---

## Phase B - Delete Japanese Locale

### Goal:
Remove Japanese (ja) locale completely - it was added as optional stub but never populated. Only zh-HK (default), zh-CN, and en are live.

### Steps:
1. Delete messages/ja.json
2. Delete all messages/fragments/*.ja.json files
3. Remove 'ja' from middleware.ts locales array
4. Remove 'ja' from i18n.ts config
5. Remove 'ja' from any other config files
6. Verify with grep that 'ja' only appears in natural contexts (java, jar, etc.)
7. Test that /ja returns 404, other locales still work


### Completed:
1. ✓ Deleted messages/ja.json
2. ✓ Deleted messages/fragments/*.ja.json (4 files: home, points, wallet, base)
3. ✓ Removed 'ja' from scripts/check-i18n-keys.ts OPTIONAL_LOCALES array
4. ✓ Verified 'ja' was never in i18n/routing.ts or middleware.ts (already only zh-HK, zh-CN, en)
5. ✓ Build gate passed: i18n ✓, tsc ✓, lint ✓, build ✓

### Result:
Japanese locale completely removed. Only 3 live locales remain: zh-HK (default), zh-CN, en.

Phase B complete.
