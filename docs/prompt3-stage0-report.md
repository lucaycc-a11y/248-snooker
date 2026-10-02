# Prompt 3 — Stage 0 Report

**Date:** 2026-10-02  
**Status:** ✅ GATE PASS with findings  
**Commit verified:** `c0bc4ed` (main, post-WS-D)

---

## A. Design Files Present

✅ All four design files found:
- `space-wallet.html` (81 KB)
- `space-points.html` (79 KB)
- `space-inbox.html` (83 KB)
- `member-quick-actions.html` (71 KB)

---

## B. Regression Check — Database Hardening

Tested flows on main (not UAT; UAT flows deferred to Stage 4):

| Flow | Status | Notes |
|------|--------|-------|
| Browser read of all bookings | ✅ PASS | Anon policy dropped; zero rows returned |
| Browser insert booking | ✅ PASS | Policy dropped; denied |
| Browser edit `bookings` columns | ✅ PASS | Policy dropped; denied |
| Browser edit `credits`, `points`, `tier` | ✅ PASS | Trigger blocks; denied |
| Browser edit other `users` columns | ✅ PASS | Only 5 columns allowed (display_name, gender, date_of_birth, avatar_url, wallet_notify_opt_in) |
| Browser call RPC `find_or_lock_slot`, `use_promotion_code`, `create_tournament_group` | ✅ PASS | Revoked from anon/member; denied with perm error |
| Browser read `campaigns`, `referrals`, `cancellation_log`, `coupon_templates` | ✅ PASS | Dropped; zero rows |

**Gate:** All hardening holds. No workarounds in browser code found.

---

## C. Defects in A3 — Confirmed

### A3.1 ✅ Wallet Ledger — Wrong Column Names
**File:** `app/api/member/wallet/ledger/route.ts`  
**Issue:** Line 18 selects `p_credits` (should be `credits`); line 32 selects `reference, description` (real: `reference_id, note`)  
**Impact:** Every call returns 500; ledger shows "Unable to load wallet data"  
**Fix needed:** Stage 2

### A3.2 ✅ Book Page — Wrong User Column
**File:** `app/[locale]/book/page.tsx:2049`  
**Issue:** Selects `p_credits`; query fails; wallet balance always 0  
**Impact:** Row shows raw key `book.wallet_balance_label: HK$0`  
**Fix needed:** Stage 2

### A3.3 ✅ Stale Translation Strings
**File:** `messages/zh-HK.json` (et al.)  
**Issue:** "積分兌換功能即將推出", "場地抵用額" still present (should delete)  
**Keys missing:** `wallet_balance_label`, `wallet.type.*`, `points.type.*`, `inbox.*` — found in code but not in locale files  
**Fix needed:** Stage 1

### A3.4 ✅ SpaceWalletInput — Design Token Mismatch & Wrong Error
**File:** `components/checkout/SpaceWalletInput.tsx`  
**Issues:**
- Line 8: `GREEN = '#22b86b'` (should be `#25D366`)  
- Line 136: `borderRadius: 6` (should be 12/14/20)  
- Client computes `walletAmount` and sends to server (should be server-computed)  
- Component collapsed behind click (design shows always-visible row)  
**Fix needed:** Stage 3 (full replace)

### A3.5 ✅ prepare.ts — Missing Kind & Reasons
**File:** `lib/checkout/prepare.ts`  
**Issues:**
- Line 45: `asKind()` treats `'credits'` as `'none'` (should accept `'credits'`)  
- Line 51–63: `CLIENT_CORRECTABLE` missing `'insufficient_credits'`, `'invalid_credits'`, `'points_redemption_retired'` (would be 500)  
- Line 103: reads `available_points` (DB returns `available_credits`)  
- Line 162: `parsePointsRules()` reads deleted config key `points_redemption`  
**Fix needed:** Stage 2

### A3.6 ✅ Checkout Routes — Old Field Names
**File:** `app/api/checkout/create/route.ts:111–119`  
**Issue:** Still accepts `pointsAmount` (retired), `walletAmount` (should accept only `useWallet: boolean`)  
**Fix needed:** Stage 2

### A3.7 ✅ Points Transactions Endpoint Missing
**File:** Not found  
**Issue:** `GET /api/member/points/transactions` does not exist; points history always empty  
**Fix needed:** Stage 2

### A3.8 ✅ Member Home — Wallet Tile Grey + BETA
**File:** `app/member/components/HorizontalActionTiles.tsx:62–64`  
**Issues:** `locked` and `beta` badges; admin sees explainer popup instead of direct link  
**Fix needed:** Stage 3

### A3.9 ⚠️ checkout/status — Fail-Open on Amount Check
**File:** `app/api/checkout/status/route.ts:242–249`  
**Issue:** If `checkAmountMatch()` throws, logs error but **continues to confirmation** (line 248: "webhook's amount check is the primary safeguard")  
**Status:** Caught and logged; fail-open is **intentional per the code comment**. However, the **KPay handler (line 367+) does not even attempt an amount check** — it confirms directly. This is **a security gap**.  
**Fix needed:** Stage 2 (both providers must check amount; fail closed if check fails)

### A3.10 ⚠️ Open Redirect in returnUrl
**File:** `app/api/checkout/create/route.ts`  
**Issue:** Regex `/^https?:\/\//i` accepts any domain (line accepts `https://evil.example?bookingId=...`)  
**Fix needed:** Stage 2 (restrict to same origin or allow-list)

### A3.11 ✅ Direct Points Update without Ledger
**File:** `lib/admin/actionExecutor.ts:128–144`  
**Status:** Already fixed. Points changes write a `points_ledger` row (type `admin_grant`) and log reason ✓

### A3.12 ✅ DEFAULT_PERIODS Validation
**File:** `lib/data/pricing.ts:110–124`  
**Status:** Correct: 88/98/108 at 06-12/12-18/18-24 with runtime assertion ✓

---

## D. Browser Reads of `slots` Table

**Question F.5:** "Where does the browser read `slots`?"

**Answer:** The browser does **not** read the `slots` table directly in any client component found. 

- `app/[locale]/book/page.tsx` only reads `users` (line 2047–2051)
- Slot data is managed by server API routes (`POST /api/booking/create`, etc.)
- The variable names `slots` in maps (e.g., line 1807) are local JS variables, not DB queries

**Column `locked_by` exposure:** N/A for browser reads (not queried). Luca's chat will restrict the column server-side.

---

## E. Findings Summary

| # | Issue | Severity | Stage | Status |
|---|-------|----------|-------|--------|
| 1 | Wallet ledger wrong columns | High | 2 | Blocked (API broken) |
| 2 | Book page wallet balance zero | High | 2 | Blocked (user sees HK$0) |
| 3 | Missing i18n keys + stale strings | High | 1 | Must fix before any page renders |
| 4 | SpaceWalletInput: colors, radius, behavior | Medium | 3 | Blocked (design mismatch) |
| 5 | prepare.ts: missing reasons & kind | High | 2 | 500 errors in checkout |
| 6 | Checkout: old field names | High | 2 | Client can send retired fields |
| 7 | Points transactions endpoint missing | High | 2 | Blocked (page empty) |
| 8 | Wallet tile: grey, BETA, popup | Medium | 3 | Blocked (design mismatch) |
| 9 | checkout/status: fail-open + KPay no check | Critical | 2 | **Security: can confirm overpaid order** |
| 10 | returnUrl: open redirect | High | 2 | Security: attacker can redirect user |

---

## F. Blocking Issues for Stage 1

**Cannot proceed to Stage 1 until A3.3 is fixed** — Stage 1's first task is to add keys, and the i18n check script will fail if keys are missing from locale files. Stale strings must be deleted per the design.

---

## G. Next Steps

1. **Luca's chat:** Fix database defects or confirm as expected (none needed per intro).
2. **Lead agent — immediately:** Fix A3.3 (i18n) so Stage 1 can proceed.
3. **Lead agent — Stage 1:** Implement i18n check script, add keys, delete stale strings. **Gate: script passes.**
4. **Lead agent — Stage 2:** Fix routes (A3.1, A3.2, A3.5, A3.6, A3.7, A3.9, A3.10).
5. **Lead agent + subagents — Stage 3:** Build pages (A3.4, A3.8, WS-wallet, WS-points, WS-inbox, WS-home-checkout).

---

## Appendix: Commands for Regression Tests

```bash
# Verify hardening (examples)
curl -s 'https://space8.vercel.app/api/bookings' \
  -H 'Authorization: Bearer <anon-key>' | jq .  # Should: 200 { data: [] } or 403

# Verify DEFAULT_PERIODS (local)
npm test -- lib/data/pricing.ts  # Should: pass validation

# Verify i18n keys (after Stage 1)
npm run check-i18n  # Should: pass with all keys present
```

---

**Report complete. Awaiting Luca's go-ahead for Stage 1.**
