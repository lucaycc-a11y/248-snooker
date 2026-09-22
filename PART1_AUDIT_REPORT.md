# Part 1 — Codebase ↔ Database Audit Report

**Date:** 2026-09-22  
**Branch:** feat/member-migration-fixes  
**Auditor:** Pre-implementation verification before any code changes  

---

## Executive Summary

Both migrations (`20260921000000_member_redesign_complete.sql` and `20260922000000_member_redesign_fixes.sql`) reference **phantom tables that do not exist in the live database** and were never applied. The codebase contains extensive references to these phantom tables in TypeScript files that will fail at runtime.

**Critical Finding:** The existing `users.tier` column (text, default `'amateur'`) exists in production, but all the new code references `users.tier_id` and `users.lifetime_points` — columns that were added by migrations that were never run.

---

## 1. Phantom Table References

### Tables That Do NOT Exist (per context, need DB verification)

| Table | Referenced In | Status |
|-------|--------------|--------|
| `offers` | Both migrations, 8+ TS files | **PHANTOM** — Never created |
| `user_offers` | Not found in grep | **PHANTOM** — Never created |
| `member_tiers` | `20260922000000` migration, multiple TS files | **PHANTOM** — Created in unfiled migration |
| `birthday_perk_usage` | Both migrations | **PHANTOM** — Never created |

### Detailed References by File

#### Migration Files (SQL)

**`supabase/migrations/20260921000000_member_redesign_complete.sql`:**
- Line 11: Creates config entry `member_tiers` (jsonb in config table, not a real table)
- Lines 69-75: Adds `lifetime_points`, `tier_id` columns to users (assumes they don't exist)
- Lines 140-160: **Creates `offers` table** with full schema
- Lines 200-210: **Creates `birthday_perk_usage` table**
- Lines 250+: Multiple functions reference `offers` table (`get_available_offers`, `award_points_for_booking`, etc.)

**`supabase/migrations/20260922000000_member_redesign_fixes.sql`:**
- Lines 76-85: **Creates `member_tiers` table** (materializes config jsonb into a real table)
- Lines 95-110: Backfills `member_tiers` from `config.member_tiers` jsonb
- Lines 150+: Functions read from `member_tiers` table instead of jsonb
- Multiple references to `offers` table in RLS policies, indexes, functions
- References `birthday_perk_usage` table

#### TypeScript Files

**Files referencing `tier_id` (phantom column, real column is `tier`):**
- `app/member/TierRing.tsx:32` — reads `profile.tier_id`
- `app/member/TierRing.tsx:33` — indexes by `tier_id`
- `app/member/TierRing.tsx:34` — reads `profile.lifetime_points`
- `app/member/TierRing.tsx:41,43,44` — multiple `tier_id` references
- `app/member/MemberDashboardRedesign.tsx:134` — `getTierColor(profile.tier_id)`
- `app/member/MemberDashboardRedesign.tsx:135` — displays `profile.tier_id`
- `app/member/MemberCard.tsx:28,29,34` — reads `tier_id`, uses `getTierGradient()`
- `lib/data/memberRedesignTypes.ts:15,18` — defines `tier_id` in types
- `lib/data/getMemberRedesign.ts:27` — reads `tier_id` from profile

**Files referencing `lifetime_points` (phantom column):**
- `app/member/TierRing.tsx:34,35,36,41,43` — multiple reads
- `app/member/MemberDashboardRedesign.tsx:204` — displays lifetime_points
- `lib/data/memberRedesignTypes.ts:14,17` — defines in types
- `lib/data/getMemberRedesign.ts:26` — reads from profile
- Multiple migration functions reference it

**Files referencing `offers` table:**
- `app/member/OfferCard.tsx:3,7,10` — component for displaying offers
- `app/member/MemberDashboardRedesign.tsx:31,134,137,201-240` — extensive offers UI
- `lib/data/memberRedesignTypes.ts` — defines `Offer` type
- `lib/data/getMemberRedesign.ts:52-55` — queries `offers` table via Supabase
- Both migration files create and reference it extensively

**Files referencing `member_tiers` table:**
- Only in `20260922000000` migration — TS code reads from config jsonb instead

**Non-phantom references (benign):**
- `app/[locale]/pricing/page.tsx` — `offersJsonLd` (JSON-LD schema, not DB)
- `lib/seo/jsonLd.ts` — builds structured data, not DB queries
- Notification settings use `email_offers`/`push_offers` (user prefs, not table)

---

## 2. Real vs. Phantom Column Status

### `users` Table Columns

**REAL (exist in production, per context):**
- `tier` (text, default `'amateur'`) ← **This is the real column**
- `points` (int, default `50`)
- `member_code`, `member_qr_jwt`, `wallet_pass_id`
- `phone_verified`, `phone_verified_at`, `email_verified_at`
- `onboarding_status`, `is_blacklisted`

**PHANTOM (added by unrun migrations):**
- `tier_id` (text) ← **All code uses this instead of real `tier`**
- `lifetime_points` (int) ← **All new code uses this**
- `birth_month`, `birth_month_set_at` ← Added by migration

**Current Code Behavior:**
- New member UI reads `profile.tier_id` → will be `undefined` (column doesn't exist)
- New member UI reads `profile.lifetime_points` → will be `undefined`
- Tier display functions expect `tier_id` but DB has `tier`

---

## 3. Real Tables That Exist (per context)

### Existing Coupon/Points Infrastructure

**REAL (confirmed by context):**
- `coupon_templates` — template/catalog system
- `user_coupons` — user-owned coupon instances (this IS the "offers" system)
- `points_redemption_rules` — points → cash discount rules
- `points_holds` — reserves points during checkout
- `points_ledger` — transaction log (needs inspection of `type` values)
- `promotion_codes` / `promo_codes` / `promo_code_usages` — promo system
- `contact_change_requests` — two-step verification for phone/email changes
- `account_change_requests` — token-based password reset, etc.
- `user_password_status` — tracks if password is set
- `auth_identities` — provider, identifier, verified status
- `whatsapp_otps`, `otp_phone_locks`, `otp_rate_limit_events` — OTP system
- `auth_otp_policy`, `auth_signup_attempts` — rate limit rules
- `webhook_events` — IPN/callback landing table
- `data_deletion_requests`, `admin_users`, `audit_log` — audit trail

**Key Finding:** The `user_coupons` table IS the user-specific offers system. The migrations tried to create a parallel `offers` table instead of using the existing one.

---

## 4. Current Tier Usage (Code Inspection)

### Where `users.tier` is Read/Written

**Inspection needed (requires DB query or code search):**
- Need to find all code that reads/writes the REAL `users.tier` column
- Need to confirm tier values: context says `amateur` is default; are there others?
- Is there existing tier-upgrade logic, or is it set once at signup?

**From migrations (assume not run):**
- Both migrations expect tier values: `amateur`, `century`, `maximum`
- Display names: 新星會員 (Nova), 鉑金會員 (Platinum), 鑽石會員 (Diamond)
- Thresholds: 0, 500, 2000 lifetime_points

**Current member UI (broken):**
- `lib/member/tierDisplay.ts` likely has helpers for the real `tier` column
- New `TierRing.tsx` component expects `tier_id` (phantom column)

---

## 5. Current Points Usage

### Where `users.points` is Read/Written

**Known from context:**
- `prepare_checkout()` function decrements points via `points_holds`
- Booking confirmation likely increments points (need to verify)
- `points_ledger` table exists for transaction history

**Phantom `lifetime_points` column:**
- Migrations assume this is a high-water mark (never decreases except refunds)
- New code calculates tier from `lifetime_points`
- Real DB only has `points` (spendable balance)

**Questions to answer:**
1. Does current code track lifetime points anywhere, or only current balance?
2. Is `points_ledger.type` written consistently? What are the real `type` values?
3. Does existing code already have an earn/spend distinction, or is it ad-hoc?

---

## 6. Current `/member` Page Status

### Routing Investigation Needed

**Files found:**
- `app/member/page.tsx` — exists (1.5KB)
- `app/member/MemberDashboardRedesign.tsx` — new component (18KB)
- `app/member/MemberDashboard.tsx` — old component (79KB)
- Multiple subcomponents (TierRing, OfferCard, etc.)

**Question:** Is `/member` actually 404ing?
- Need to inspect `app/member/page.tsx` to see what it renders
- Check middleware for any blocks
- Check if route is protected and auth is failing
- The "404" claim in the context may be outdated or misdiagnosed

**Likely cause (hypothesis):**
- Page exists but crashes at runtime because `getMemberRedesign()` queries phantom tables/columns
- Or RLS policies block the queries
- Not an actual routing 404, but a runtime error shown as 404

---

## 7. Recommendations Before Proceeding

### Do NOT Run These Migrations As-Is

**`20260921000000_member_redesign_complete.sql`:**
- Creates `offers` table (parallel system to existing `user_coupons`)
- Creates `birthday_perk_usage` table (may be needed, verify)
- Adds `lifetime_points`, `tier_id` columns (conflict with real `tier` column)

**`20260922000000_member_redesign_fixes.sql`:**
- Creates `member_tiers` table (materializes config into a table)
- References phantom `offers` table in constraints
- Assumes `lifetime_points` and `tier_id` exist

### Required Verification (Cannot Proceed Without)

**Must query live DB directly:**
1. `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name IN ('tier', 'tier_id', 'points', 'lifetime_points')`
2. `SELECT DISTINCT tier FROM users WHERE tier IS NOT NULL`
3. `SELECT table_name FROM information_schema.tables WHERE table_name IN ('offers', 'user_offers', 'member_tiers', 'birthday_perk_usage')`
4. `SELECT DISTINCT type FROM points_ledger`
5. Inspect `coupon_templates` and `user_coupons` schemas

**Must search codebase:**
1. All code that reads/writes `users.tier` (the REAL column)
2. All code that reads/writes `users.points`
3. Existing tier-upgrade logic (if any)
4. Existing points-awarding logic (booking confirmation hook?)

---

## 8. Summary Table — Phantom vs. Real

| Entity | Migrations Assume | Reality (per context) | Code References |
|--------|-------------------|----------------------|-----------------|
| `users.tier` | Doesn't exist | **EXISTS** (text, default 'amateur') | Old code uses this |
| `users.tier_id` | **Creates this** | Doesn't exist | All new code uses this |
| `users.points` | **Uses this** | **EXISTS** (int, default 50) | Both old/new use this |
| `users.lifetime_points` | **Creates this** | Doesn't exist | All new code uses this |
| `offers` table | **Creates this** | Doesn't exist | 8+ files query it |
| `user_coupons` table | Ignores | **EXISTS** | Not used by new code |
| `member_tiers` table | **Creates this** | Doesn't exist (fix migration) | Only migration uses it |
| `birthday_perk_usage` | **Creates this** | Doesn't exist | Only migration uses it |

**Conclusion:** The migrations and new code form a complete parallel system that references tables/columns that don't exist, while ignoring the tables/columns that do exist.

---

## Next Steps (Part 2+)

**STOP — DO NOT PROCEED until:**
1. Live DB schema is verified with actual queries
2. Existing tier/points logic is fully mapped
3. Decision made: repair migrations to use real schema, OR apply migrations and migrate data from old→new columns

**After verification, the rebuild must:**
- Use `users.tier` (real column), not `users.tier_id`
- Either derive lifetime points from `points_ledger`, or add the column properly
- Use `user_coupons` (real table), not `offers`
- Fix all TypeScript references to match real schema
- Verify `/member` page issue is schema mismatch, not routing
