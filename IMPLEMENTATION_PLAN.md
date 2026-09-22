# Implementation Plan — Member System Rebuild

**Branch:** `feat/member-db-audit-rebuild`  
**Target Merge:** `uat` only (NOT main)  
**Date:** 2026-09-22

---

## Verified Schema (Live Database)

### users table
- `tier` (text, default 'amateur') — CHECK constraint: 'amateur' | 'century' | 'maximum'
- `points` (int, default 50) — net spendable balance
- NO `tier_id`, NO `lifetime_points`

### Tier distribution (current data)
- `amateur`: 10 users
- `maximum`: 1 user
- `century`: 0 users (valid but unused)

### points_ledger
- `type` values: `'booking'` (112 rows, earn), `'manual'` (1 row, earn)
- NO spend/redeem type — redemptions handled via `points_holds` only

### points_holds (redemption system)
- Columns: id, booking_id, order_group_id, user_id, checkout_key, points, discount_amount, status, held_at, redeemed_at, released_at, created_at
- This is where points→discount happens; never written back to points_ledger

### Existing coupon/offer system
- `coupon_templates` — offer catalog ✅ EXISTS
- `user_coupons` — user-owned offer instances ✅ EXISTS

### Phantom tables (confirmed NOT exist)
- `offers` ❌
- `member_tiers` ❌
- `birthday_perk_usage` ❌

---

## Tier Name Mapping (Luca-confirmed)

| DB Value | Display Names |
|----------|---------------|
| `amateur` | 新星會員 (zh-HK) / 新星会员 (zh-CN) / Nova (en) / ノヴァ (ja) |
| `century` | 鉑金會員 (zh-HK) / 铂金会员 (zh-CN) / Platinum (en) / プラチナ (ja) |
| `maximum` | 鑽石會員 (zh-HK) / 钻石会员 (zh-CN) / Diamond (en) / ダイヤモンド (ja) |

---

## Architecture Decision: Lifetime Points

### Current State
- `users.points` = net spendable balance (earn - redeem)
- No tracking of "total earned over lifetime"
- Tier upgrades would be based on... what exactly?

### Options

**Option A: Derive from points_ledger (no new column)**
```sql
SELECT user_id, SUM(points) as lifetime_earned
FROM points_ledger
WHERE type IN ('booking', 'manual')  -- earn types only
GROUP BY user_id
```
- Pros: No schema change, single source of truth
- Cons: Requires aggregate query for tier calculation

**Option B: Add users.lifetime_points (new column)**
```sql
ALTER TABLE users ADD COLUMN lifetime_points integer DEFAULT 0;
-- Backfill from ledger
UPDATE users SET lifetime_points = (
  SELECT COALESCE(SUM(points), 0)
  FROM points_ledger
  WHERE user_id = users.id AND type IN ('booking', 'manual')
);
```
- Pros: Fast tier checks, clear high-water mark
- Cons: New column to maintain, must keep in sync with ledger

**Option C: Use current balance only (no lifetime tracking)**
- Tier based on `users.points` (current spendable balance)
- Redeeming points could cause tier downgrade (probably wrong product-wise)

### Recommendation: **Defer to Luca**

For Phase 1 (this task), I'll:
1. Build tier display using existing `users.tier` values
2. Show `users.points` as current balance
3. Build a "points ring" UI that shows progress but WITHOUT "next tier at X points" (since we don't have thresholds defined for the real tier system yet)
4. Flag the lifetime-tracking decision as a product question

---

## Part 2 — Member Page Rebuild

### Fix Strategy

1. **Delete phantom migration files**
   - `supabase/migrations/20260921000000_member_redesign_complete.sql` → DELETE
   - `supabase/migrations/20260922000000_member_redesign_fixes.sql` → DELETE
   - Create ONE new migration that only adds what's actually needed

2. **Fix TypeScript types**
   - `lib/data/memberRedesignTypes.ts` → replace `tier_id` with `tier`, remove `lifetime_points`
   - Add proper type mapping for tier enum

3. **Fix data fetching**
   - `lib/data/getMemberRedesign.ts` → query real columns, use `user_coupons` not `offers`
   - Map `coupon_templates` to "catalog", `user_coupons` to "owned"

4. **Fix UI components**
   - `app/member/TierRing.tsx` → use `profile.tier`, show `profile.points`
   - `app/member/MemberCard.tsx` → use `profile.tier` for color/gradient
   - `app/member/MemberDashboardRedesign.tsx` → remove `lifetime_points` display
   - `app/member/OfferCard.tsx` → use `UserCoupon` type from real schema

5. **Fix `/member` page**
   - `app/member/page.tsx` → verify it renders, diagnose real error

### Tier Display Helpers

Create `lib/member/tierHelpers.ts`:
```typescript
export type TierValue = 'amateur' | 'century' | 'maximum'

export const TIER_NAMES = {
  amateur: { zh_hk: '新星會員', zh_cn: '新星会员', en: 'Nova', ja: 'ノヴァ' },
  century: { zh_hk: '鉑金會員', zh_cn: '铂金会员', en: 'Platinum', ja: 'プラチナ' },
  maximum: { zh_hk: '鑽石會員', zh_cn: '钻石会员', en: 'Diamond', ja: 'ダイヤモンド' }
} as const

export function getTierColor(tier: TierValue): string {
  // Return Tailwind classes for tier badge
}

export function getTierGradient(tier: TierValue): string {
  // Return gradient for card background
}
```

---

## Part 3 — IPN Verification

### Locate Real Handler

Search for:
- KPay callback route (likely `app/api/kpay/callback` or similar)
- Webhook handler that writes to `webhook_events`
- Booking confirmation logic that awards points

### Verify Implementation

1. **Signature verification**
   - Check for KPay signature header validation
   - Confirm shared secret is used
   - Test with tampered payload (on UAT only)

2. **Idempotency**
   - Check for `webhook_events.id` deduplication
   - Verify booking can't be confirmed twice
   - Test by replaying same payload

3. **Points awarding**
   - Confirm `points_ledger` entry created with `type='booking'`
   - Confirm `users.points` incremented
   - Check for race conditions (multiple simultaneous IPNs)

4. **Logging**
   - Confirm `webhook_events` row created with all fields
   - Confirm `provider` field populated (found null rows earlier)
   - Confirm errors logged with full payload for debugging

---

## Part 4 — Login System (Uber-style)

### Locate Current Auth

Search for:
- Login entry point (likely `app/[locale]/login` or `app/auth/login`)
- OTP sending logic (uses `whatsapp_otps` table)
- Password verification (uses `user_password_status`)

### Restyle to Uber Pattern

1. **Phone number entry** (Step 1)
   - Large input, country code selector
   - "Continue" CTA pinned to bottom
   - Rate limit messaging from `auth_otp_policy`

2. **OTP verification** (Step 2)
   - Six-box input with auto-advance
   - `autocomplete="one-time-code"` for iOS autofill
   - Resend button with cooldown from `auth_otp_policy`
   - Lockout messaging from `otp_phone_locks`

3. **Password (if set)** (Step 3)
   - Only shown if `user_password_status.password_set = true`
   - "Forgot password" link → password reset flow
   - Option to login with OTP instead

4. **Redirect handling**
   - Accept `?redirect=/booking/ABC123` param
   - Sanitize: only relative paths starting with `/`, reject `//`, `\`, absolute URLs

---

## Part 5 — Settings: Change Password/Phone/Email

### Use Existing Tables

- `account_change_requests` — for password reset links
- `contact_change_requests` — for phone/email changes

### Change Password Flow

1. Settings → "Change Password" → sheet confirmation
2. Backend creates `account_change_requests` row:
   - `purpose = 'password_reset'` (or whatever existing code uses)
   - `token_hash = hash(randomBytes(32))` (never store plain token)
   - `expires_at = now() + 30min`
3. Email sent with link: `https://space8.com.hk/auth/reset-password?token=RAW_TOKEN`
4. User clicks → page verifies token hash + expiry → shows password form
5. On submit: update `user_password_status`, mark token `used_at = now()`

### Change Phone/Email Flow

1. Settings → "Change Phone" → sheet confirmation
2. Backend creates `contact_change_requests` row:
   - `kind = 'phone'` or `'email'`
   - `current_value` = existing phone/email
   - `new_value` = new phone/email
   - `status = 'awaiting_current'`
3. **Two-step verification:**
   - Step A: Send code to CURRENT contact → user enters → `current_verified_at` set, `status = 'awaiting_new'`
   - Step B: Send code to NEW contact → user enters → `new_verified_at` set, `status = 'completed'`
4. On completion: update `users.phone`/`users.email`, update `auth_identities`

### Security Requirements

- **Token hashing:** Never store raw tokens, always hash (SHA-256 minimum)
- **Single-use:** Check `used_at IS NULL`, set atomically on consumption
- **Race protection:** Test concurrent use of same link (only one succeeds)
- **Rate limiting:** Max N requests per user per hour (use existing rate-limit tables)

---

## Verification Checklist

### Part 2: Member Page
- [ ] `/member` returns 200 for authenticated user
- [ ] Tier displayed matches `users.tier` value from DB
- [ ] Points displayed match `users.points` value from DB
- [ ] Tier badge shows correct localized name (zh-HK 新星會員 for amateur)
- [ ] Rewards catalog shows coupons from `coupon_templates`
- [ ] User's owned coupons show from `user_coupons`
- [ ] No console errors on member page

### Part 3: IPN
- [ ] Replayed IPN payload is idempotent (no double points)
- [ ] Tampered payload signature fails validation
- [ ] Failed IPN creates `webhook_events` row with `status='error'`
- [ ] Successful IPN creates `webhook_events` row with `status='processed'`
- [ ] `webhook_events.provider` field populated (not null)

### Part 4: Login
- [ ] Phone entry → OTP → login succeeds
- [ ] Password login (if password set) succeeds
- [ ] Resend cooldown matches `auth_otp_policy` seconds
- [ ] Lockout message shown after N failed attempts
- [ ] `redirect=/booking/ABC` works
- [ ] `redirect=//evil.com` rejected
- [ ] `autocomplete="one-time-code"` present on OTP input

### Part 5: Settings
- [ ] Change password: email received with working link
- [ ] Change password: used/expired link shows blocked state
- [ ] Change password: concurrent double-use only succeeds once
- [ ] Change phone: current-phone verification required first
- [ ] Change phone: cannot skip to new-phone verification
- [ ] Change email: same two-step flow enforced
- [ ] Rate limit prevents spam requests

### Build & Deploy
- [ ] `npm run build` passes (no TypeScript errors)
- [ ] `npx tsc --noEmit` passes
- [ ] Committed to `feat/member-db-audit-rebuild`
- [ ] Merged into `uat` (NOT main)
- [ ] `git merge-base --is-ancestor <commit> uat` proves merge
- [ ] UAT deployment succeeds
- [ ] Manual smoke test on UAT

---

## Files to Modify

### Delete (phantom migrations)
- `supabase/migrations/20260921000000_member_redesign_complete.sql`
- `supabase/migrations/20260922000000_member_redesign_fixes.sql`

### Create (new minimal migration)
- `supabase/migrations/20260923000000_member_cleanup.sql` — only adds missing bits, no phantom tables

### Fix (types)
- `lib/data/memberRedesignTypes.ts` — use `tier`, remove `lifetime_points`
- `lib/member/tierHelpers.ts` — NEW file for tier display logic

### Fix (data fetching)
- `lib/data/getMemberRedesign.ts` — query real schema

### Fix (UI components)
- `app/member/page.tsx` — diagnose/fix
- `app/member/TierRing.tsx` — use `tier`, `points`
- `app/member/MemberCard.tsx` — use `tier`
- `app/member/MemberDashboardRedesign.tsx` — remove `lifetime_points`
- `app/member/OfferCard.tsx` — use `user_coupons` type

### Investigate & Fix (IPN, login, settings)
- Search for KPay/webhook handler
- Search for login routes
- Search for settings routes
- Fix each per plan above

---

## Git Strategy

1. Create branch: `git checkout -b feat/member-db-audit-rebuild`
2. Commit in logical chunks:
   - "fix(member): delete phantom migrations and update types to use real schema"
   - "fix(member): rebuild member dashboard to use tier/points from real users table"
   - "fix(ipn): verify idempotency and signature validation"
   - "fix(auth): restyle login to Uber pattern"
   - "fix(settings): wire change-password/phone/email to existing request tables"
3. Build verification: `npm run build && npx tsc --noEmit`
4. Merge to uat: `git checkout uat && git merge feat/member-db-audit-rebuild`
5. Prove: `git merge-base --is-ancestor $(git rev-parse HEAD) uat`
6. Push: `git push origin uat`

---

## Open Questions for Luca

1. **Lifetime points tracking:** Should tier be based on total points earned over time (requires new column or ledger aggregation), or on current spendable balance? If lifetime, should we add `users.lifetime_points` column now?

2. **Tier upgrade thresholds:** Config shows 0/500/2000 points for tier thresholds, but these were never applied. Should we implement auto-upgrade logic based on these thresholds, or is tier manually assigned?

3. **Birthday perk:** Context mentions a birthday perk system. Should we implement `birthday_perk_usage` table, or defer this feature?

4. **Offer vs. Coupon terminology:** Use "rewards" (會員獎勵), "coupons" (優惠券), or "offers" (優惠) in the UI?

---

## Time Estimate

- Part 1: ✅ DONE (audit report)
- Part 2: ~2 hours (member page rebuild)
- Part 3: ~1 hour (IPN verification)
- Part 4: ~2 hours (login restyle)
- Part 5: ~3 hours (settings flows)
- Testing: ~2 hours (end-to-end verification)
- **Total: ~10 hours**

Split into checkpoints — deliver Part 2, verify, then proceed to Part 3+.
