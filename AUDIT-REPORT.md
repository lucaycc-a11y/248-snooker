# Space8 Compliance & Performance Audit Report

**Date:** 2026-09-19  
**Auditor:** Claude (Opus 5)  
**Scope:** Website (public + member area) — excludes iOS admin app, iPad kiosk app, payment logic, `config` table business rules, `_deprecated/` components

---

## PASS 1: PRE-FIX AUDIT

### Part A — Legal / Compliance Checklist (20 items)

#### A1. Privacy policy
**Status:** ✅ Present and correct  
**Evidence:** `/content/legal/privacy.zh-HK.ts` exists with comprehensive PDPO-compliant policy covering data collection, usage, third-party sharing, retention, user rights, security measures (including PCI DSS payment processing), CCTV, account security. Linked in Footer at line 462-472. Available in zh-HK/zh-CN/en.

#### A2. Terms of service
**Status:** ✅ Present and correct  
**Evidence:** `/content/legal/terms.zh-HK.ts` exists with detailed venue usage rules covering membership, booking, age limits, facility rules, damage liability, weather policy, and legal jurisdiction. Linked in Footer. Available in all 3 locales.

#### A3. Refund policy
**Status:** ✅ Present and correct  
**Evidence:** `/content/legal/refund-policy.zh-HK.ts` exists reflecting actual reservation rules: no cancellation after confirmation (except weather/company fault), payment failure handling, 7-day weather rescheduling, refund processing timelines. Available in all locales.

#### A4. Cookie policy
**Status:** ⚠️ Mentioned in privacy policy but no dedicated page  
**Evidence:** Privacy policy section 7 mentions cookies (privacy.zh-HK.ts line 33-35), but no standalone `/cookie` route or dedicated cookie policy document exists in `/content/legal/`.

#### A5. Cookie consent banner
**Status:** ❌ Missing  
**Evidence:** Searched entire codebase — no `CookieBanner`, `CookieConsent` component exists. No cookie consent UI in `app/layout.tsx` or any global layout. Privacy policy mentions cookies but no active consent mechanism.

#### A6. Form consent checkboxes
**Status:** ⚠️ Booking has checkbox, member signup needs verification  
**Evidence:** 
- Booking form (`app/[locale]/book/page.tsx:type="checkbox"`) — found checkbox reference, need to verify it's explicit consent, not just terms acknowledgment
- Member signup flow — need to check `app/api/auth/signup/route.ts` for explicit consent checkbox

#### A7. No unnecessary data collection
**Status:** 🔍 Needs audit  
**Evidence:** Pending form field audit against actual usage

#### A8. Third-party SDKs audit
**Status:** 🔍 Needs cross-check  
**Evidence:** 
- `app/layout.tsx` loads reCAPTCHA (line 102-104)
- Privacy policy lists: payment processors, cloud DB (Supabase), SMS verification, email (Resend), WhatsApp automation
- Need to verify all loaded scripts match disclosure

#### A9. No dark patterns
**Status:** 🔍 Needs UI audit  
**Evidence:** Pending booking flow and form inspection

#### A10. No hidden fees
**Status:** 🔍 Needs booking flow check  
**Evidence:** Pending price breakdown inspection before payment confirmation

#### A11. Fake reviews
**Status:** 🔍 Needs content audit  
**Evidence:** Pending testimonial/review section search

#### A12. Unsupported claims
**Status:** 🔍 Needs marketing copy audit  
**Evidence:** Pending "best"/"No.1"/"首間" claim verification

#### A13. Accessibility alt text
**Status:** 🔍 Needs image audit  
**Evidence:** Pending comprehensive image `alt` attribute check

#### A14. Color contrast
**Status:** 🔍 Needs WCAG AA check  
**Evidence:** Pending contrast audit on dark sections (tokens.colors in use)

#### A15. Keyboard navigation
**Status:** 🔍 Needs interaction audit  
**Evidence:** Pending focus state and keyboard operability check

#### A16. Business details
**Status:** ✅ Present  
**Evidence:** Footer.tsx lines 186-253 display full address (泰力工業中心, Tai Yau Street, San Po Kong), phone (SITE_CONTACT.phone), email (Admin@space8.com.hk), hours (06:00-24:00), map link. LocalBusiness schema at lines 257-296.

#### A17. Age consent for minors
**Status:** ✅ Documented, technically N/A  
**Evidence:** Terms explicitly state under-12 must be accompanied by 18+ adult who takes full responsibility (terms.zh-HK.ts lines 14). No direct signup for under-18 since requires phone/email which implies adult account holder.

#### A18. Unsubscribe link in emails
**Status:** 🔍 Needs email template check  
**Evidence:** Email templates found at `lib/resend/templates/` — need to verify each has unsubscribe/preference link

#### A19. Licensed fonts/images
**Status:** 🔍 Needs asset inventory  
**Evidence:** Bebas Neue (Google Fonts, open), need to audit images in `/public/`

#### A20. Data deletion request
**Status:** ❌ No flow exists  
**Evidence:** Privacy policy mentions deletion right (privacy.zh-HK.ts line 26), but no actual `/member/delete-account` route, no UI, no RPC function found. **Critical gap.**

---

### Part B — Performance Checklist (20 items)

#### B1. API responses cached
**Status:** 🔍 Needs header/implementation check  
**Evidence:** Pending

#### B2. Load balancing
**Status:** ✅ N/A (Vercel deployment)  
**Evidence:** Single Vercel deployment — load balancing handled by Vercel Edge Network

#### B3. Database indexes
**Status:** 🔍 Needs Supabase schema check  
**Evidence:** Pending actual query pattern analysis

#### B4. Images compressed
**Status:** 🔍 Needs file size audit  
**Evidence:** Pending `/public/` image inspection

#### B5. Loading skeletons
**Status:** 🔍 Needs UI component check  
**Evidence:** Pending data-dependent view inspection

#### B6. Expensive queries cached
**Status:** 🔍 Needs query audit  
**Evidence:** Pending

#### B7. No N+1 query patterns
**Status:** 🔍 Needs Supabase call audit  
**Evidence:** Pending booking/member flow inspection

#### B8. Debounced input handlers
**Status:** 🔍 Needs search/availability check  
**Evidence:** Pending

#### B9. Code splitting
**Status:** 🔍 Needs build output check  
**Evidence:** Next.js 14 App Router has automatic code splitting, need to verify bundles

#### B10. CDN for static assets
**Status:** ✅ Vercel default  
**Evidence:** Vercel deployment — static assets served via Vercel Edge CDN by default

#### B11. Server-side caching
**Status:** 🔍 Needs implementation check  
**Evidence:** Pending

#### B12. Pagination on large lists
**Status:** 🔍 Needs member history check  
**Evidence:** `app/api/member/notifications/route.ts` has `.limit(50)` (line 20) — need to check pagination for booking history

#### B13. Lighthouse audit
**Status:** 🔍 Needs actual run  
**Evidence:** Pending — will run after initial findings

#### B14. API payloads compressed
**Status:** 🔍 Needs response header check  
**Evidence:** Pending gzip/br verification

#### B15. No unnecessary re-renders
**Status:** 🔍 Needs profiler check  
**Evidence:** Pending React DevTools profiler run

#### B16. JS/CSS minified
**Status:** 🔍 Needs build verification  
**Evidence:** Next.js production build minifies by default, need to confirm

#### B17. Lazy loading
**Status:** 🔍 Needs component audit  
**Evidence:** Footer uses `dynamic()` for FooterMap (line 19-37) — need broader audit

#### B18. Non-critical scripts deferred/async
**Status:** ✅ reCAPTCHA is lazyOnload  
**Evidence:** `app/layout.tsx` line 103 uses `strategy="lazyOnload"`

#### B19. No unused dependencies
**Status:** 🔍 Needs depcheck run  
**Evidence:** Pending

#### B20. Database connection pooling
**Status:** ✅ Supabase default  
**Evidence:** Supabase handles connection pooling by default (PgBouncer)

---

### Part C — i18n/SEO Constraints

**桌球/中八/香港 presence check:**
- 🔍 Pending audit across home, booking, about, venue pages
- Must not break any locale while fixing A/B items
- Must verify site builds cleanly in zh-HK, zh-CN, en after changes

---

### Part D — Double-Confirmation Requirement

**Actions requiring double-confirm:**
1. ❌ Data deletion request (A20) — **does not exist yet**
2. 🔍 Email notification toggle in member area — **need to find and verify**
3. 🔍 Any other destructive/opt-out toggles — **need to inventory**

**Requirements:**
- Second explicit confirmation step (modal/equivalent)
- Plain 書面語 explaining real consequence
- Confirm button uses primary brand color (cancel = visually default/safe)

---

#### A6. Form consent checkboxes (CONTINUED)
**Status:** ✅ Present and explicit  
**Evidence:** `app/[locale]/book/page.tsx:2423` — Terms checkbox exists. Reading full context shows it's explicit consent with link to terms document, not just acknowledgment.

#### A7. No unnecessary data collection
**Status:** ✅ Forms collect only required data  
**Evidence:** Booking form collects: name, email, phone (all needed for reservation/entry QR). Member signup: same fields. No excessive collection found.

#### A8. Third-party SDKs audit
**Status:** ⚠️ reCAPTCHA loaded but not disclosed  
**Evidence:** `app/layout.tsx:102-104` loads Google reCAPTCHA with site key. Privacy policy (privacy.zh-HK.ts) lists payment processors, Supabase, SMS verification, Resend, WhatsApp automation but **does NOT mention Google reCAPTCHA**. Needs disclosure.

#### A9. No dark patterns
**Status:** ✅ No dark patterns found  
**Evidence:** Booking flow reviewed — no pre-ticked opt-ins, no hidden unsubscribe, no deceptive button hierarchy. Payment confirmation clearly shows total before proceeding.

#### A10. No hidden fees
**Status:** ✅ Full price breakdown shown  
**Evidence:** `app/[locale]/book/page.tsx:2326-2378` — Payment screen shows subtotal, discount (if any), points earned, and total before payment method selection. No service fees, no hidden charges.

#### A11. Fake reviews
**Status:** ✅ No testimonials/reviews found  
**Evidence:** Searched codebase — no testimonial, review, or customer feedback sections exist on the site.

#### A12. Unsupported claims
**Status:** ❌ "香港首間" claim needs verification  
**Evidence:** `app/layout.tsx:22` meta description states "香港首間自助中式桌球會所" (Hong Kong's first self-service Chinese eight-ball venue). This is a factual claim that must be verifiable. If not substantiated, it violates HK Trade Descriptions Ordinance.

#### A13. Accessibility alt text
**Status:** 🔍 Needs comprehensive image audit  
**Evidence:** Spot check needed across all pages

#### A14. Color contrast
**Status:** 🔍 Needs WCAG AA audit  
**Evidence:** Dark theme with tokens — needs systematic check

#### A15. Keyboard navigation
**Status:** 🔍 Needs interaction test  
**Evidence:** Pending focus state verification

#### A18. Unsubscribe link in emails
**Status:** ❌ Missing from all email templates  
**Evidence:** `lib/resend/templates/booking-confirmation.ts` lines 1-148 — NO unsubscribe link. Transactional emails sent to members have no preference management or unsubscribe mechanism. Violates best practice and potentially PDPO requirements for marketing emails.

#### A19. Licensed fonts/images
**Status:** ✅ Fonts OK, images need inventory  
**Evidence:** Bebas Neue (Google Fonts, SIL Open Font License). Images in /public/ appear to be original Space8 venue photos.

---

### Part B — Performance Checklist (20 items) — CONTINUED

#### B3. Database indexes
**Status:** 🔍 Needs Supabase schema inspection  
**Evidence:** Migrations exist in `supabase/migrations/` but need to verify indexes on frequently-queried columns (bookings by user_id, by date, by table_number)

#### B4. Images compressed
**Status:** ❌ Large unoptimized PNGs found  
**Evidence:** 
- `public/gallery/S2/part2_table_closeup.png` — 1.4MB
- `public/gallery/S2/part3_table_wide_room.png` — 1.9MB
- `public/gallery/S2/part1_tap_to_enter.png` — large
These are uncompressed PNGs that should be WebP or optimized

#### B12. Pagination on large lists
**Status:** ⚠️ Partial — notifications paginated, bookings not checked  
**Evidence:** `app/api/member/notifications/route.ts:20` has `.limit(50)` but no pagination params. Need to check member booking history.

#### B13. Lighthouse audit
**Status:** 🔍 Will run after fixes  
**Evidence:** Pending

#### B16. JS/CSS minified
**Status:** ✅ Confirmed  
**Evidence:** Build succeeded, Next.js 14 minifies by default in production mode

#### B19. No unused dependencies
**Status:** ⚠️ 4 unused dependencies found  
**Evidence:** Depcheck output shows:
- Unused: `@remotion/player`, `google-auth-library`, `shadcn`, `tw-animate-css`
- Unused devDeps: `@axe-core/cli`, `@axe-core/playwright`, `autoprefixer`, `patch-package`, `postcss`

---

### Part C — i18n/SEO Constraints (CONTINUED)

**桌球/中八/香港 presence verified:**
- ✅ `app/[locale]/page.tsx` meta includes: "中八", "中式桌球", "香港中八", "新蒲崗桌球"
- ✅ Keywords array contains all required terms
- ✅ Content naturally includes these terms

**"首間" (first) claim found:**
- ❌ `app/layout.tsx:22` — "香港首間自助中式桌球會所" requires verification

---

### Part D — Double-Confirmation Requirement (CONTINUED)

**Destructive/opt-out actions inventory:**

1. ❌ **Data deletion request** — Does not exist (A20)
2. 🔍 **Email notification toggle** — Found `app/api/member/notifications/route.ts` but it's read-only (GET/PATCH to mark read). Need to find actual preference toggle.
3. 🔍 **Member account settings** — Need to locate settings UI

---

## SUMMARY OF CRITICAL ISSUES

### Must Fix (❌)
1. **A4** — Create dedicated cookie policy page
2. **A5** — Implement cookie consent banner
3. **A8** — Disclose reCAPTCHA in privacy policy
4. **A12** — Verify/remove "香港首間" claim
5. **A18** — Add unsubscribe links to all email templates
6. **A20** — Build data deletion request flow with double-confirm
7. **B4** — Compress large images (1.4MB-1.9MB PNGs → WebP)

### Should Fix (⚠️)
1. **B12** — Add pagination to member booking history
2. **B19** — Remove unused dependencies

### Needs Investigation (🔍)
1. **A13-A15** — Accessibility audit (alt text, contrast, keyboard nav)
2. **B3** — Database indexes verification
3. **B13** — Lighthouse audit
4. **Part D** — Find and verify all email notification toggles

---

## Next Steps

1. ✅ Evidence gathering complete for initial audit
2. **NOW:** Implement all critical fixes (❌)
3. Investigate and fix ⚠️ items
4. Complete 🔍 investigations
5. **PASS 2: RE-AUDIT all 40 items from scratch**
6. Generate before/after comparison table
7. Flag any regressions

---

_Proceeding to implementation phase..._
