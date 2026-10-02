# Stage 3 — WS-A Brief: Pricing Display & Server Pricing

**Owner:** All prices, rates, time ranges, hours, and the server booking price computation.

**Files owned (exclusive edit):**
- Landing page pricing section (app/[locale]/home/PricingSection.tsx)
- Slot selection / picker (components/booking/SlotPicker.tsx, related)
- Checkout summary (components/checkout/OrderSummary.tsx)
- Member history display (app/member/components/BookingHistory.tsx)
- Email templates (resend templates for booking confirmation, receipt, etc.)
- Help Center / FAQ articles (if they mention prices)
- Legal pages (場地使用守則, 條款) — pricing sections only
- Page metadata, OG tags, JSON-LD (app/[locale]/page.tsx metadata, sitemap)
- Booking API route that writes prices (app/api/booking/route.ts or equivalent)
- Any test or UAT pricing logic

**Shared dependencies (cannot edit; request in docs/part2-shared-requests.md if needed):**
- lib/pricing/config.ts, lib/pricing/compute.ts, lib/pricing/format.ts (already built, Stage 2)
- lib/copy/points-credit.ts (already built, Stage 2)
- Database config table

---

## Tasks (in order)

### 1. Replace hardcoded prices with getPricing()

Grep your owned files for these values and replace:
- `88`, `98`, `108` (current rates)
- `60`, `78`, `80`, `120` (legacy rates — DELETE if found; these are old)
- Any `/小時`, `每小時`, `per hour`
- Time ranges: `06:00`, `12:00`, `18:00`, `24:00`, `00:00`
- Labels: `繁忙`, `非繁忙`, `深夜`, `週末`, `peak`, `off_peak`, `rateFrom2h`

**Pattern:**
```typescript
// Old (bad):
const morningRate = 88;
const eveningLabel = "18:00-24:00";

// New (good):
const pricing = await getPricing();
const morningRate = pricing.periods.find(p => p.id === 'morning')?.base;
const eveningLabel = formatPeriodLabel(pricing.periods.find(p => p.id === 'evening'));
```

### 2. Server booking route: compute price, ignore client price

The route that creates a booking (POST /api/booking or equivalent) must:
- Read the requested date, start_time, end_time from the request
- Call `computeBookingPrice(date, startTime, endTime, pricing)` on the **server** to get the subtotal
- Write `slots.price = subtotal` and `bookings.base_price = subtotal` to the database
- **Ignore any price sent by the client** (strip it from the request before processing)
- Return the computed price to the client (not the client's guess)

**Pattern:**
```typescript
const pricing = await getPricing();
const priceResult = computeBookingPrice(
  req.body.date,
  req.body.startTime,
  req.body.endTime,
  pricing,
);
// Write ONLY the server-computed price
slots.price = priceResult.subtotal;
bookings.base_price = priceResult.subtotal;
// Return it to client
return { price: priceResult.subtotal };
```

### 3. Fix is_test marking

Check how bookings are created and ensure `is_test = false` is set server-side when `NEXT_PUBLIC_APP_ENV === 'production'`, and `is_test = true` in UAT/dev. The database should never accept a booking with mismatched flag and environment.

### 4. Remove old config readers

Delete or update any code that reads:
- `config.pricing` (old; key deleted from database)
- `config.points_redemption` (old; key deleted)
- `rateFrom2h`, `pricing.rules`, `periods` (old fields)
- Any table: `uat_test_pricing`, `points_holds`, `points_redemption_rules`

If you find a reader, **report it** instead of trying to restore the table.

### 5. Opening hours and max booking hours

Displayed hours must come from:
- `site.openHour` / `site.closeHour` (canonical: 6 / 24)
- `booking_rules.max_hours` (canonical: 12)
- **NOT** from `venue.open_hour`, `venue.close_hour`, `venue.name` (stale; report any reader)

### 6. Deposit and overstay

Displayed amounts shown anywhere (`preauth_deposit`, `overstay_per_15min`) come from `pricing_rates`:
```typescript
const pricing = await getPricing();
const deposit = pricing.preauth_deposit;
const overstay = pricing.overstay_per_15min;
```

### 7. Delete /pricing and all references

✅ **Already done in hotfix.** Verify:
- `app/[locale]/pricing/` directory deleted
- No link, button, or menu item points to `/pricing`
- Sitemap does not include `/pricing`
- Search for `/pricing` in your owned files and remove any reference

### 8. Past bookings show stored total_price, never recomputed

```typescript
// Correct: use what was actually charged
const totalPrice = booking.total_price;

// Wrong: recompute and show a different number
const totalPrice = computeBookingPrice(...);
```

### 9. Pricing display audit (WS-A acceptance test)

Write an automated test (Playwright) that:
1. Visits every surface that shows a price on mobile AND desktop widths:
   - Landing page (pricing section)
   - Slot selection for every hour 06:00–23:00 on a weekday AND a weekend day
   - Checkout summary
   - Member history page
   - FAQ / Help Center articles (if they mention prices)
   - Legal pages (pricing sections)
   - Rendered email templates (preview mode if available)

2. Extracts every `HK$` or `$` amount and every time range visible on the page

3. For each extracted value, verify it is explained by the database:
   - Per-hour rate in `pricing_rates` (88 / 98 / 108)
   - A booking total computed by `computeBookingPrice`
   - `preauth_deposit` (500)
   - `overstay_per_15min` (50)
   - A stored past booking `total_price`
   - Any other source must be reported as a failure

4. **Critical checks:**
   - 06:00–12:00 shows 88 (not 60, 78, 80, 120)
   - 12:00–18:00 shows 98
   - 18:00–24:00 shows 108
   - All surfaces show the **same time ranges and rates**

5. On UAT, change `pricing_rates.morning.base` to a test value (e.g., 999), reload the site, and verify every surface shows 999 for morning bookings. Then restore it.

6. Attach the extracted pricing table and before/after screenshots to your report.

---

## Acceptance Criteria

- ✅ Unit tests pass (inherited from Stage 2)
- ✅ All hardcoded prices (88/98/108/60/78/80/120) replaced with dynamic reads
- ✅ Server booking route computes price, ignores client price
- ✅ `is_test` marked correctly (report what you find)
- ✅ Opening hours, max hours from canonical `site` and `booking_rules` only
- ✅ Deposit and overstay amounts from `pricing_rates`
- ✅ No `/pricing` page or references remain
- ✅ Past bookings show stored `total_price`
- ✅ Pricing display audit passes (all surfaces, all widths, all values explained)
- ✅ UAT test: change rate → reload → verify all surfaces update → restore
- ✅ `npm run build` passes
- ✅ `npx tsc --noEmit` passes

---

## Key Constraints

- **Do not edit:** lib/pricing, lib/copy, database, lib/wallet, lib/inbox
- **Do not touch:** member self-service top-up, tier upgrade UI, admin-only features
- **Do not query:** archived tables (points_holds, uat_test_pricing, points_redemption_rules)
- **Do make requests:** if you find a reader of deleted config keys, report it in docs/part2-shared-requests.md

---

## Report Template (submit at end)

```
## WS-A Report

### Files Changed
- app/[locale]/home/PricingSection.tsx
- components/booking/SlotPicker.tsx
- ... (list all)

### Key Findings
- Removed N hardcoded prices
- Fixed server booking route to compute price (client price now ignored)
- is_test handling: [FINDING]
- Deposit/overstay from pricing_rates: ✅
- /pricing deleted: ✅
- Past bookings use stored total_price: ✅

### Audit Results
- Surfaces checked: landing, slot selection (06:00-23:00 weekday/weekend), checkout, history, FAQ, legal, emails
- Pricing values extracted: [attach table]
- Screenshots: [attach before/after UAT test]
- All rates explained by database: ✅ / ❌ [if fail, list unexplained values]

### Commands Run
- npm run build ✅
- npx tsc --noEmit ✅
- Playwright audit: ✅

### Could Not Verify
- [list anything you couldn't test]
```
