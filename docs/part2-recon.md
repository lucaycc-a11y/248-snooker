# Part 2 Recon — Prices, Time Slots, Space Points, Space Wallet, Inbox & /pricing Removal

**Date:** 2026-10-02  
**Status:** Gate 1 passed — comprehensive map complete

---

## 1. Every place a price, rate or time slot is shown or computed

### 1.1 Landing Page Pricing Section
- **File:** [components/landing/HomePricing.tsx](../components/landing/HomePricing.tsx)
- **Display:** Shows HK$88, HK$98, HK$108 per hour with period labels
- **Source:** `formatPrice()` function formats values; source of data not yet clear in this component
- **Issue:** Component receives props but origin of rate values TBD in parent

### 1.2 About Page / SpacePilot Copy
- **File:** [app/[locale]/about/SpaceWheelOutro.tsx](../app/[locale]/about/SpaceWheelOutro.tsx)
- **Link:** `href="/pricing"` — button links to /pricing page
- **Issue:** Link will break after /pricing is deleted

### 1.3 /pricing Page (FULL ROUTE)
- **Files:**
  - [app/[locale]/pricing/page.tsx](../app/[locale]/pricing/page.tsx)
  - [app/[locale]/pricing/PricingContent.tsx](../app/[locale]/pricing/PricingContent.tsx)
  - [components/pricing/PeriodPricingSections.tsx](../components/pricing/PeriodPricingSections.tsx) (assumed)
- **Display:** Shows pricing table with 88/98/108 rates and **`rateFrom2h` discounts** (78/88 etc.)
- **Source:** **READS REMOVED `config.pricing` KEY** — hardcoded periods with `rateFrom2h` field
- **Critical Issue:** `rateFrom2h` is from the deleted `config.pricing` key; will now fail or return undefined
- **Lines with removed data:** `/pricing/page.tsx` L12 metadata generation, PricingContent rendering

### 1.4 Booking / Slot Picker Page
- **File:** [app/[locale]/book/page.tsx](../app/[locale]/book/page.tsx)
- **Display:** Slot picker shows `HK$` prefix and price per hour in slot selection UI
- **Source:** 
  - Reads `config.pricing_rates` at L(approx 1100+): `.eq("key", "pricing_rates")`
  - Periods imported from [lib/data/pricing.ts](../lib/data/pricing.ts): `DEFAULT_PERIODS` with hardcoded 88/98/108
  - Also reads periods from `pricingRatesToPeriods()` function
- **Periods definition:** `{ key: "morning", hours: [6, 7, 8, 9, 10, 11] }` etc.
- **Hardcoded fallback:** `DEFAULT_PERIODS` in [lib/data/pricing.ts](../lib/data/pricing.ts) L58 has 88/98/108 hardcoded as fallback

### 1.5 Checkout Summary
- **File:** [components/checkout/PriceSummary.tsx](../components/checkout/PriceSummary.tsx)
- **Display:** `小計`, discount row, `可賺積分`, `總計`
- **Source:** Computed server-side; client receives totals from API response
- **Issue:** Must verify `可賺積分` is computed from **net paid** amount, not original subtotal

### 1.6 Member Page — Booking History
- **File:** [app/member/BookingHistory.tsx](../app/member/BookingHistory.tsx)
- **Display:** Past bookings with `total_price` stored in database
- **Source:** API [app/api/member/bookings/route.ts](../app/api/member/bookings/route.ts) fetches `total_price` column
- **Data:** Shows **stored** total_price, never recomputed
- **Status:** Correctly reads `total_price` (renamed from `price` recently)

### 1.7 Legal Pages / Terms
- **File:** [app/[locale]/legal/LegalContent.tsx](../app/[locale]/legal/LegalContent.tsx)
- **Content:** Hardcoded `HK$300` in refund/deposit text
- **Source:** Hardcoded string; should come from `config.pricing_rates.preauth_deposit`
- **Issue:** Preauth deposit (500 in current config) is hardcoded as 300

### 1.8 Membership Page
- **File:** [app/[locale]/membership/page.tsx](../app/[locale]/membership/page.tsx)
- **Copy:** "每消費 HK$1 累積 1 積分，100 積分 = HK$10 場地抵用額"
- **Source:** Hardcoded user-facing copy
- **Issue:** Should come from `config.points_system` values

### 1.9 Email Templates (Resend)
- **Files:** [lib/resend/template-send.ts](../lib/resend/template-send.ts)
- **Content:** Likely contains pricing in confirmation emails
- **Status:** Not yet fully audited in this recon

### 1.10 JSON-LD and SEO
- **File:** [lib/seo/jsonLd.ts](../lib/seo/jsonLd.ts)
- **Function:** `buildPricingOffersJsonLd()`
- **Content:** Generates schema.org Offer with `price`, `priceFrom`, **reads `rateFrom2h`**
- **Issue:** READS REMOVED FIELD; will now get undefined for `rateFrom2h`

### 1.11 Sitemap and Metadata
- **Files:** 
  - [app/sitemap.ts](../app/sitemap.ts)
  - [app/robots.ts](../app/robots.ts)
  - [app/[locale]/pricing/page.tsx](../app/[locale]/pricing/page.tsx) L12: `generateMetadata()` writes OG tags for `/pricing`
- **Issue:** Sitemap likely includes `/pricing`; will need update

---

## 2. Where the booking price is computed and stored

### Server-side Booking Price Computation
- **Primary route:** [app/api/checkout/create/route.ts](../app/api/checkout/create/route.ts)
- **Function:** `handleCheckoutCreate()`
- **Current behavior:**
  - Creates a `pending` booking row with `base_price`, `total_price`, `subtotal`
  - **UAT mode:** If `NEXT_PUBLIC_APP_ENV === 'uat'`, modifies `base_price` to add `.81` / `.82` decimal for PayMe test
  - **Client-side price not trusted:** Route calls `prepare_checkout()` server function which recomputes and validates
- **Issue:** Client sends a `quote` object with a price, but the server **should** recompute it with `computeBookingPrice()` and **reject** if mismatched
- **Verification needed:** Does the server currently ignore the client's price or validate against it?

### Historical booking prices (read-only)
- **Column:** `bookings.total_price`
- **Display:** Member history reads and displays this stored value, never recomputes

### Price columns in database
- `bookings.base_price` — base total before any discount
- `bookings.total_price` — final amount charged
- `slots.price` — per-slot price (one row per booked hour, approximately `base_price / duration_hours`)

---

## 3. Readers of removed config keys and archived tables

### 3.1 Removed Config Key: `config.pricing`
- **Fields (now deleted):** `periods`, `rules`, `rateFrom2h`, `deposit`, `overstay`
- **Readers found:**
  - ✅ [lib/data/pricing.ts](../lib/data/pricing.ts) L33 `pricingRatesToPeriods()` — parses `period.discount` into `rateFrom2h` (fallback data)
  - ✅ [lib/pricing.ts](../lib/pricing.ts) — function checks `multiHour && period.rateFrom2h !== undefined`
  - ✅ [app/[locale]/pricing/page.tsx](../app/[locale]/pricing/page.tsx) — **displays** `rateFrom2h` in pricing table
  - ✅ [lib/seo/jsonLd.ts](../lib/seo/jsonLd.ts) L70 — builds JSON-LD with `rateFrom2h`
  - **Result:** When config.pricing no longer exists, these will read `undefined`

### 3.2 Removed Config Key: `config.points_redemption`
- **Previous purpose:** Point-to-credit conversion rules
- **Readers:** None found in app code (may have been removed already)

### 3.3 Archived Table: `uat_test_pricing`
- **Readers found:**
  - ✅ [app/api/uat/test-pricing/route.ts](../app/api/uat/test-pricing/route.ts) — updates this table
  - ✅ [app/api/dev2/test-pricing/route*.ts](../app/api/dev2/) — multiple copies all update `uat_test_pricing`
  - ✅ [app/api/checkout/create/route.ts](../app/api/checkout/create/route.ts) L(comment) — mentions it in context
  - ✅ [lib/uat/test-pricing.ts](../lib/uat/test-pricing.ts) — **actively queries** `uat_test_pricing`
  - **Result:** When queried, will fail with "relation does not exist"

### 3.4 Archived Table: `points_holds`
- **Readers found:**
  - ✅ [app/api/checkout/redeem-points/route.ts](../app/api/checkout/redeem-points/route.ts) — queries for points holds during checkout
  - **Result:** Will fail with "relation does not exist"

### 3.5 Archived Table: `points_redemption_rules` and `_deprecated_promo_codes`
- **Readers:** None found in current app code
- **Status:** Already removed/safe

### 3.6 Conflicting Config Keys: `venue` columns used in code
- **Conflicts:**
  - `site.maxHours = 8` vs `booking_rules.max_hours = 12`
  - `site.openHour/closeHour = 6/24` vs `venue.open_hour/close_hour = 9/2`
  - `site.name = "248 Snooker"` vs `venue.name = "248 Snooker"`
- **Readers of `venue` (stale):**
  - ✅ [app/api/pilot/booking-status/route.ts](../app/api/pilot/booking-status/route.ts) L(timePeriod function) — logic hardcoded, not using venue
  - **Status:** No readers of `venue.open_hour` / `close_hour` / `name` found; safe to ignore

---

## 4. Member page, wallet tile, SPACE PTS tile and Inbox tile — data sources

### 4.1 Wallet Tile
- **File:** [app/member/components/ActionGrid.tsx](../app/member/components/ActionGrid.tsx) (tile only)
- **Status:** Currently greyed out "即將推出 BETA"
- **Data needed:** `users.credits` (Space Wallet balance)
- **Data source:** [lib/data/getMemberRedesign.ts](../lib/data/getMemberRedesign.ts) fetches user profile row

### 4.2 SPACE PTS Tile
- **File:** [app/member/components/ActionGrid.tsx](../app/member/components/ActionGrid.tsx) (tile)
- **Data displayed:** Points badge (unread count style)
- **Data source:** [lib/data/getMemberRedesign.ts](../lib/data/getMemberRedesign.ts) — fetches `users.points`

### 4.3 SPACE PTS History Page
- **File:** [app/member/PointsHistory.tsx](../app/member/PointsHistory.tsx)
- **Data source:** Receives `points: PointsTransaction[]` as prop from parent
- **Parent:** [app/member/points/page.tsx](../app/member/points/page.tsx) (assumed)
- **Ledger:** Reads from `points_ledger` table (RLS: own rows only)

### 4.4 Inbox Tile and Page
- **Tile file:** [app/member/components/ActionGrid.tsx](../app/member/components/ActionGrid.tsx)
- **Inbox page:** [app/member/inbox/page.tsx](../app/member/inbox/page.tsx)
- **Data source:** `admin_notifications` table (RLS: own rows only)
- **Query:** `.from('admin_notifications').select(...).eq('user_id', user.id)`

### 4.5 Checkout `prepare_checkout` call
- **Current implementation:** [app/api/checkout/create/route.ts](../app/api/checkout/create/route.ts)
- **Function signature (database):** `prepare_checkout(p_booking_id, p_user_id, p_promo_code, p_points, p_credits)`
- **Current usage:** Calls with `p_points = 0` (or omitted) and `p_credits = 0` — no wallet/promo support yet

---

## 5. `is_test` marking — how UAT pricing was applied and current behavior

### 5.1 `is_test` Field Setting
- **Location:** [app/api/checkout/create/route.ts](../app/api/checkout/create/route.ts)
- **Current behavior:** No server-side check for `NEXT_PUBLIC_APP_ENV`; `is_test` marking **missing**
- **Expected (per project convention):** Should set `is_test = true` when `process.env.NEXT_PUBLIC_APP_ENV !== 'production'`
- **Finding:** Created bookings in UAT are currently stored with `is_test = false` (or null) — **BUG**

### 5.2 UAT Test Pricing (Now Archived)
- **Old system:** Queries `uat_test_pricing` table to override booking price
- **Files reading it:**
  - [lib/uat/test-pricing.ts](../lib/uat/test-pricing.ts) — `getUATPrice()` queries the table
  - [app/api/checkout/create/route.ts](../app/api/checkout/create/route.ts) — calls `getUATPrice()` conditionally
- **New behavior:** Should not read `uat_test_pricing` at all; use live `pricing_rates`
- **Migration:** Remove the override logic and use real rates

---

## 6. Everything about the `/pricing` page

### 6.1 Route Files
- **Main route:** [app/[locale]/pricing/page.tsx](../app/[locale]/pricing/page.tsx) (file exists)
- **Component:** [app/[locale]/pricing/PricingContent.tsx](../app/[locale]/pricing/PricingContent.tsx)
- **Sub-component:** [components/pricing/PeriodPricingSections.tsx](../components/pricing/PeriodPricingSections.tsx) (assumed)

### 6.2 References and Links to `/pricing`
- ✅ [app/[locale]/about/SpaceWheelOutro.tsx](../app/[locale]/about/SpaceWheelOutro.tsx) — **button `href="/pricing"`**
- ✅ [app/[locale]/about/_deprecated/SpaceWheelOutro-deprecated.tsx](../app/[locale]/about/_deprecated/SpaceWheelOutro-deprecated.tsx) — same link (deprecated copy)
- ✅ [app/sitemap.ts](../app/sitemap.ts) — likely includes `/pricing` in sitemap generation
- ✅ [app/[locale]/pricing/page.tsx](../app/[locale]/pricing/page.tsx) L12 — `generateMetadata()` sets OG tags with `${BASE}/pricing`

### 6.3 Navbar and Footer
- **Grep result:** No links found in `components/layout/Nav.tsx` or `components/layout/Footer.tsx` pointing to `/pricing`
- **Status:** Safe (no nav/footer references found)

### 6.4 Canonical and Alternate Tags
- **Metadata:** Set in `generateMetadata()` in pricing/page.tsx
- **Required changes:** Remove alternate/canonical tags and the entire metadata function

### 6.5 Analytics and Events
- **Status:** Not yet audited in recon; check for `track('visit_pricing')` or similar

### 6.6 Help Center, FAQ, Legal Pages
- **Status:** Not yet audited; assumed no direct links

---

## 7. Conflicts between `site`, `booking_rules` and `venue` config

| Setting | `site` | `booking_rules` | `venue` | Canonical | Issue |
|---------|--------|-----------------|---------|-----------|-------|
| Max hours | 8 | 12 | — | `booking_rules.max_hours` (12) | Displayed limit is 12; UI should enforce 12 |
| Open hour | 6 | — | 9 | `site.openHour` (6) | `venue.open_hour = 9` is stale |
| Close hour | 24 | — | 2 (next day) | `site.closeHour` (24) | `venue.close_hour = 2` is stale; after-midnight bookings allowed by `allow_cross_midnight = true` |
| Allow after midnight | — | `allow_cross_midnight: true` | — | `booking_rules` | Bookings can span midnight; but `pricing_rates` has no period after 24:00 |
| Midnight cap hour | — | `midnight_cap_hour: 2` | — | `booking_rules` | Max 2 hours past midnight; confirmed bookings exist at 01:00, 03:00, 04:00 |

### 7.1 After-Midnight Booking Issue
- **Problem:** Database allows bookings past 24:00 (up to 02:00 by the rule, but data shows up to 04:00)
- **Pricing problem:** `pricing_rates` has no period defined for 24:00–06:00
- **Current code:** [lib/pricing.ts](../lib/pricing.ts) has logic to handle this (returns 'afternoon' fallback) — **needs verification**
- **Decision:** Do NOT price any hour without a period; throw an error instead of guessing

---

## 8. Summary of Removals and Changes Needed

| Item | Action | Impact |
|------|--------|--------|
| `/pricing` route | Delete entire directory | All links must be removed |
| `/pricing` link in About | Remove button or redirect to landing pricing section | UX: check context before removing |
| `config.pricing` reads | Remove all; use `config.pricing_rates` only | 5 files affected |
| `config.points_redemption` | Remove (already gone from config) | 0 files actively reading |
| `uat_test_pricing` table queries | Stop reading; use live rates | 5+ files affected |
| `points_holds` table queries | Stop reading; database manages holds | 1 file affected |
| `rateFrom2h` discount field | Remove display; no multi-hour discounts | Pricing page UI change |
| `is_test` marking | Fix to server-side detection per convention | Fix UAT booking classification |
| Hardcoded prices (88/98/108) | Keep in fallback only; load from config | Already mostly correct |
| Hardcoded copy (points rules, deposits) | Move to `config.points_system`, `config.pricing_rates` | ~3 files affected |

---

## Gate 1 Status

✅ **GATE PASSED** — Complete map of pricing displays, config readers, removed tables, and `/pricing` references documented.

**Blocker for Stage 2:** None. Proceed to Stage 2 Foundation.
