# Venue Page Fix Pass — Sub-agent Plan

## Phase 0 Diagnosis — Complete

### 1. Broken Images Root Cause

**Problem:** Room Viewer images show broken icons with visible alt text.

**Root cause:** Incorrect paths in `lib/data/venue-rooms.ts`
- Data file uses: `/images/about-06-lounge.webp`
- Actual location: `public/images/space8-about-photos/images/about-06-lounge.webp`
- Files ARE tracked by git and exist on disk
- Missing subdirectory: `space8-about-photos/images/` in the paths

**Affected images:**
- `/images/about-06-lounge.webp` → should be `/images/space8-about-photos/images/about-06-lounge.webp`
- `/images/about-07-stools.webp` → should be `/images/space8-about-photos/images/about-07-stools.webp`
- `/images/about-03-corner-pocket.webp` → should be `/images/space8-about-photos/images/about-03-corner-pocket.webp`

**Working images (correct paths):**
- ✓ `/images/venue-page-infinity.jpg`
- ✓ `/images/venue-page-eternity.jpg`
- ✓ `/gallery/spacepliot.png`

**Fix:** Update all three paths in `lib/data/venue-rooms.ts` with correct subdirectory structure.

---

### 2. Pricing Cards Invisible Content

**Problem:** Pricing section on Venue page shows only "$ / 小時" — slot names, times, prices invisible.

**Root cause analysis needed:**
- Current theme: `tokens.colors.bg` (dark graphite #14161A)
- Card text color: `tokens.colors.text` (#FFFFFF)
- Check computed styles at runtime for:
  - Slot name `{period.name}` at line 376
  - Time label `{period.time_label}` at line 365
  - Price `${period.hourly_rate}` at line 387
- Verify `period` object has data (not null/undefined)
- Check motion animation end state (stuck at opacity 0?)
- Verify config fetch succeeds as anonymous visitor

**Most likely causes:**
1. Data fetch failing (empty `periods` array or RLS blocking anonymous reads)
2. Animation not completing (stuck at `opacity: 0, y: 30`)
3. Text rendering but invisible due to color/opacity issue

---

### 3. Copy Audit Results

**Deprecated strings found in `messages/zh-HK.json`:**

Line 3253: `"main": "簡約工業風格，純黑配色。"`
Line 3254: `"small": "英式斯諾克球桌，專業 LED 照明。"`
Line 3266: `"main": "Aramith 比賽級球組，英國 Riley 球桌。"`
Line 3267: `"small": "世界錦標賽指定用球。"`

**Location:** `venue.rooms.pills` object (pills 1 and 3)

**Action:** Delete these strings and replace with PDF spec strings in Agent A.

**Repo-wide "中八" hits (outside Venue page):**
- `PRODUCT.md:11` — Product description doc (informational, keep)
- `COMPREHENSIVE_OVERHAUL_SUMMARY.md` — Multiple hits in changelog (historical, keep)
- `IMAGE_AUDIT_REPORT.md` — Image filename references (metadata, keep)

**Term note:** "中八" appears only in filenames and historical docs, NOT in user-facing code. No action needed outside Venue page.

**Not found:** 一瞥場地, Riley, 斯諾克 (outside the zh-HK.json hits above)

---

### 4. Existing Button Components

**Found components:**
- `components/ui/button.tsx` — Base UI library button (shadcn/base-ui style with CVA variants)
- `components/ui/BackButton.tsx` — Specialized back navigation
- `components/shared/BackButton.tsx` — Another back button variant
- `components/shared/WhatsAppButton.tsx` — Contact button
- `components/shared/ContactButton.tsx` — Generic contact
- `components/auth/AppleSignInButton.tsx` — OAuth button
- `components/auth/GoogleSignInButton.tsx` — OAuth button
- `components/checkout/ApplePayButton.tsx` — Payment button
- `components/admin/ui/Button.tsx` — Admin-specific button

**Current Venue page button usage:**
- Pricing section (line ~387-400): No button rendered, just price display
- HowToGo section: Two buttons (Google Maps 導航, 立即預訂) using inline `<a>` and `<Link>` with inline styles

**Shared component button usage:**
- `components/landing/HowToGo.tsx` lines 286-343: Two inline buttons with styled `<a>` and `<Link>`, no Button component
- Universal Pricing (`components/ui/pricing-cards.tsx`) line 529-538: Uses `<Link>` with className "pricing-cta", no Button component

**Decision:** Agent E will create NEW Apple-style Button component at `components/ui/AppleButton.tsx` (do not modify existing `button.tsx` which is a library component). Apply to Venue pricing, HowToGo, and universal Pricing.

---

### 5. Pure Black Token and Navbar Height

**Pure black token:** `#000000`
- Found in: `components/landing/HomePricing.tsx:93` → `background: isDark ? "#000000" : "#ffffff"`
- Found in: `components/landing/Section4TableTransition.tsx:109, 128` → `backgroundColor: "#000"`
- Token system: `tokens.colors.bg` is `#14161A` (graphite), NOT pure black
- **No pure black token exists** — Home uses hardcoded `#000000` for dark sections

**Action:** Agent A will use `#000000` hardcoded for Room Viewer section background (matching Home's pattern).

**Navbar height:**
- No constant found in `Nav.tsx` or `tokens.ts`
- Nav component uses inline styles, no exported height value
- Visual inspection needed: likely 64-72px on desktop, 56-60px on mobile
- **Action:** Agent A will calculate navbar height from rendered Nav component or use safe default of `64px` with a CSS variable

---

### 6. Pre-Change Hero Photos

**Original Hero (commit 236fa947, first venue Hero):**
8 photos total:
1. `/images/space-infinity-room-中八桌球-香港新蒲崗.webp`
2. `/images/space-eternity-room-中八桌球-香港新蒲崗.webp`
3. `/images/venue-interior-中八桌球-香港新蒲崗.webp`
4. `/images/pool-table-closeup-中八桌球-香港新蒲崗.webp`
5. `/images/pool-table-closeup-2-中八桌球-香港新蒲崗.webp`
6. `/images/space-pilot-scoreboard-中八桌球-香港新蒲崗.webp`
7. `/images/cue-stand-中八桌球-香港新蒲崗.webp`
8. `/images/sofa-lounge-中八桌球-香港新蒲崗.webp`

**Current Hero (after c242e95 de-duplication):** 4 photos

**Action:** Agent B will restore all 8 original photos with exact same filenames.

---

## File Ownership by Agent

| Agent | Owns (exclusive write) | Runs |
|---|---|---|
| **E — Button** | `components/ui/AppleButton.tsx` (new)<br>`messages/zh-HK.json` (`ui.button.*` keys only) | First (blocking) |
| **A — RoomViewer v2** | `components/ui/RoomViewer.tsx`<br>`lib/data/venue-rooms.ts`<br>`messages/zh-HK.json` (`venue.rooms.*` keys only)<br>`app/[locale]/venue/preview/room-viewer/page.tsx` | After E, parallel |
| **B — Hero** | `components/ui/cinematic-orbit-hero.tsx`<br>`messages/zh-HK.json` (`venue.hero.*` keys, read-only audit) | Parallel |
| **C — Why Us + Pricing** | `components/ui/ThreePoints.tsx`<br>`components/ui/pricing-cards.tsx`<br>`messages/zh-HK.json` (`venue.whyUs.*`, `venue.pricing.*` keys only) | Parallel |
| **D — Services** | `app/[locale]/venue/VenueContent.tsx` (服務說明 section only, lines ~408-421)<br>`messages/zh-HK.json` (`venue.services.*` keys only) | Parallel |
| **QA** | Nothing (read-only) | Last |

**Shared read-only resources:**
- `app/styles/tokens.ts`
- `components/landing/HowToGo.tsx` (Agent E patches buttons, others read-only)
- `app/[locale]/venue/VenueContent.tsx` (Agent D owns 服務說明 section; others read structure only)

---

## Critical Rules for All Agents

1. **Image paths:** Use EXACT case-sensitive paths as found in `public/` directory
2. **Copy:** ONLY use strings from the task prompt PDF spec — never keep or write other copy
3. **No shadows:** Borders only, token-based colors, no hardcoded hex except `#000000` where Home uses it
4. **Tokens:** All colors from `app/styles/tokens.ts`, no hardcoded values except pure black
5. **i18n:** Add keys ONLY under your namespace; do not edit other namespaces
6. **Mobile-first:** Design at 390px, then 820px, then 1440px
7. **Contrast:** WCAG AA minimum for all text and buttons
8. **Motion:** Off under `prefers-reduced-motion: reduce`
9. **Deprecated code:** Move to `_deprecated/`, never delete

---

## Verification Checklist (QA Agent)

- [ ] All Room Viewer images load (no broken icons)
- [ ] Pricing cards show slot names, times, prices, buttons on dark theme
- [ ] No deprecated copy strings remain in Venue page
- [ ] Hero has 8 photos (original count restored)
- [ ] Hero photos do not overlap text or navbar at any viewport
- [ ] Room Viewer compare bar works (touch + keyboard + mouse)
- [ ] `?room=eternity` URL param works on main Venue page
- [ ] Why Us sheet overlap visible (rounds corners, overlaps Room Viewer by ~48px)
- [ ] All buttons use AppleButton component
- [ ] Pricing shows "HK$" not "$"
- [ ] All tap targets ≥44px
- [ ] No horizontal overflow at 390px
- [ ] No console or TypeScript errors
- [ ] Build passes

---

**Status:** Phase 0 diagnosis complete. Ready to spawn sub-agents.
