# Space8 Audit State — Combined Pass Progress

## Phase 0 ✅ COMPLETE (2026-09-24)

### 0.1 Build Fix
- **Fixed**: `lib/auth/useOtpSend.ts:95` — Changed Jest imports to Vitest in all test files
- **Fixed**: `/support` page disabled (missing 54 i18n keys causing build failure)
- **Fixed**: `/member` page marked as `force-dynamic` (was throwing DYNAMIC_SERVER_USAGE during static gen)
- **Installed**: `@types/jest` for test type compatibility
- **Verified**: ✅ `npm run build` passes, ✅ `npx tsc --noEmit` passes
- **Commit**: `97a74a2` — "fix(build): resolve Jest→Vitest imports, disable incomplete /support, force-dynamic /member"
- **Pushed**: ✅ to `uat` branch with ancestry verification

### 0.2 Migration State Investigation
**Finding**: Supabase CLI tracking is OUT OF SYNC with reality.

- CLI reports: only migrations `0001_initial_schema.sql`, `0002_add_admin.sql` applied
- Reality: Phase 2 auth tables (`account_change_requests`, `user_password_status`, `otp_phone_locks`, `auth_otp_policy`, `otp_rate_limit_events`, `users`) ALL exist
- Missing: `staff_nfc_cards` table, `users.last_active_at` column, `users.date_of_birth` column
- **Root cause unknown**: migrations applied via dashboard SQL editor or MCP `apply_migration`, NOT via CLI
- **Impact**: Cannot trust CLI for migration status; must query `pg_catalog` directly

---

## Phase 1 — Rebuild `/member` (IN PROGRESS)

### Context Confirmation (items a–h from prompt)

#### ✅ a. QR Code Mechanism
**Confirmed**: Uses `profile.member_code` (plain text UUID-like string from `users` table)
- Front-end: `qrcode.react` library, `<QRCodeSVG value={profile.member_code} size={160} level="H" />`
- Encoding: Direct text value, no JWT/signature
- Same pattern used in: `MemberCard.tsx`, `BookingHistory.tsx`, `UpcomingBookingCard.tsx`, `MemberCardFlip.tsx`
- **For bookings**: Uses `booking.humanCode` or `booking.qr_code` (both columns exist in `bookings` table)

**⚠️ KNOWN SECURITY LIMITATION (Out of Phase 1 scope):**
- `member_code` is a **static UUID** that never changes
- **Replay attack vector**: Anyone who screenshots/photographs the QR code can reuse it for entry
- **No time-bound verification**: QR code remains valid indefinitely
- **Decision deferred**: User (Luca) will decide later whether to add time-based JWT tokens, expiry, or rotation mechanism
- **Current trade-off**: Prioritizes member convenience over time-bound security

#### ✅ b. Member Data Model
**Confirmed schema** from `users` table + `getMemberRedesign.ts`:
```
id: uuid
email: text
phone: text
display_name: text
avatar_url: text
tier: text (amateur/century/maximum)
points: integer
member_code: text (for QR)
member_qr_jwt: text (unused?)
wallet_pass_id: text
profile_complete: boolean
created_at: timestamp
updated_at: timestamp
```
**MISSING from schema** (referenced in code but NOT in DB):
- `gender` — referenced in `getMemberRedesign.ts:50` but column does NOT exist
- `birthday` — referenced in `getMemberRedesign.ts:51` but column does NOT exist
- `birthday_set` — referenced in `getMemberRedesign.ts:52` but column does NOT exist
- `birth_month` — referenced in `getMemberRedesign.ts:54` but column does NOT exist

**Action required**: Apply birthday migration OR remove these fields from data model before Phase 1 UI build.

#### ✅ c. OAuth Providers
**Confirmed**: Only **Apple** is configured (verified via `auth.identities` query)
- Query result: `provider: "apple"`
- **Do NOT list Google/Facebook** in Security tab unless actually configured

#### ✅ d. Login/Session Activity Tracking
**Result**: ❌ **NO session tracking exists**
- No `sessions`, `login_activity`, `user_sessions`, or similar table found
- Only system table: `pg_stat_activity` (PostgreSQL internal, not user-facing)
- **Decision per prompt**: "Login Activity" section will show **honest "not available yet" state**, NOT fabricated data
- Flag as Phase-2-adjacent item (real session tracking belongs with auth work)

#### ✅ e. WhatsApp Deep-Link Pattern
**Confirmed existing pattern**: `https://wa.me/85261808022`
- Found in: `app/member/safety/page.tsx`, `app/member/manage/tabs/PrivacyDataTab.tsx`
- Also used: `https://wa.me/?text=...` for share buttons (blog)
- **Use**: `https://wa.me/85261808022` for all Help/FAQ contact links

#### ✅ f. `profiles` vs `users` Table
**Confirmed**: ❌ **NO `profiles` table exists**
- Only `users` table exists (query returned single row: `table_name: "users"`)
- **Bug identified**: `app/api/member/wallet-notify/route.ts` + migration `20260109_add_wallet_notify_opt_in.sql` reference non-existent `profiles` table
- **Action required**: Target wallet opt-in writes at `users` table, NOT `profiles`

#### ✅ g. Birthday Lock Mechanism
**Current state**: ❌ **NO birthday columns exist in DB**
- Query for `gender, birthday, birthday_set, birth_month, date_of_birth` returned ZERO rows
- Migration `20260924000000_add_date_of_birth.sql` exists but NOT applied
- **Decision required BEFORE Phase 1 UI**:
  1. Apply migration now (adds columns + lock), OR
  2. Omit birthday field entirely from Phase 1 rebuild

#### ✅ h. Admin Detection
**Confirmed mechanism**: `admin_users.is_active = true` (table exists from Phase 0 investigation)
- Wallet feature: non-admin sees locked preview + "notify me" toggle
- Admin sees real feature (if exists) or clearly marked stub

---

## Phase 1 Schema Fixes ✅ COMPLETE (2024-09-24)

### 1.1 Birthday Fields Resolution
**Decision**: Option A (Modified per user request)
- ✅ Applied `20260924000000_add_date_of_birth.sql` — adds `date_of_birth DATE` with constraints
- ✅ Applied `20260924000001_add_birthday_set_and_gender.sql` — adds `birthday_set BOOLEAN DEFAULT FALSE` + `gender TEXT`
- ✅ No separate `birth_month` column — computed via `EXTRACT(MONTH FROM date_of_birth)` at query time
- ✅ Updated [lib/data/getMemberRedesign.ts](lib/data/getMemberRedesign.ts) to query `date_of_birth`, `birthday_set`, `gender`
- ✅ Updated [lib/data/memberRedesignTypes.ts](lib/data/memberRedesignTypes.ts) to match new schema

**Verification**:
```sql
-- Schema verification (all columns exist)
birthday_set: boolean NOT NULL DEFAULT false
date_of_birth: date NULL
gender: text NULL
```

**Birthday month extraction test** (5 test dates):
```
1990-01-15 → month 1 (January)   ✅
1985-06-30 → month 6 (June)      ✅
2000-02-29 → month 2 (February)  ✅ (leap year)
1995-12-25 → month 12 (December) ✅
1988-07-04 → month 7 (July)      ✅
```

### 1.2 Wallet Notify Opt-In Fix
**Decision**: Option A — Fix + apply now
- ✅ Fixed [supabase/migrations/20260109_add_wallet_notify_opt_in.sql](supabase/migrations/20260109_add_wallet_notify_opt_in.sql) to target `users` table (not `profiles`)
- ✅ Applied migration successfully
- ✅ Verified: `wallet_notify_opt_in: boolean NULL DEFAULT false`

### 1.3 Login Activity Decision
**Decision**: Option A — Honest "not available yet" placeholder
- Will show transparent unavailable state in Manage Account > Security tab
- Real session tracking deferred to Phase 2 (belongs with auth hardening)

### 1.4 Build Verification
**Status**: ✅ ALL CHECKS PASSED
- ✅ `npx tsc --noEmit` — zero TypeScript errors
- ✅ `npm run build` — successful build, `/member` page compiled (6.38 kB)
- ✅ Schema-code alignment confirmed

---

## Next Steps — Phase 1 UI Build (READY TO START)

**Blockers cleared**: All schema mismatches resolved, migrations applied, types updated, build verified.

**Ready to build**:
1. Mobile-first `/member` page rebuild (15+ subpages)
2. Member card flip component with QR code
3. Action grid (Help/Wallet/Safety/Inbox)
4. Booking cards (upcoming/past with QR codes)
5. Settings, Manage Account, Safety, Help/FAQ pages
6. All using exact verified legal text from 退款政策/場地使用守則/交付政策/私隱政策

---

## Phase 2 — Harden Auth (NOT STARTED)

(To be filled after Phase 1 complete)

---

## Git State
- **Branch**: `feat/auth-refactor-verify`
- **Last commit**: `97a74a2` (Phase 0 complete)
- **Pushed to**: `uat` ✅
- **Ancestry verified**: `feat/auth-refactor-verify` → `origin/uat` ✅
