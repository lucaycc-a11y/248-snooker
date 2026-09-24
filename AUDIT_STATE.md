# Combined Pass Audit State

## Started: 2026-09-24

### Ground Rules Acknowledged
- No destructive Supabase operations without explicit confirmation
- No push to `main`, no Vercel promote
- Push to `uat` after each phase with ancestry proof
- Diagnose root cause before fixing

---

## Phase 0 — Unblock

### Starting Phase 0 at 2026-09-24

#### Fix 1: Test imports (✅ DONE)
- **Error**: `lib/auth/__tests__/*.test.ts` imported from `@jest/globals` but project uses Vitest
- **Fix**: Changed imports to `import { describe, it, expect } from 'vitest'`
- **Result**: `npx tsc --noEmit` passes ✅

#### Fix 2: Build failures identified
**Build still fails with:**

1. **Missing i18n keys** (lines 346-1017 of build output):
   - `help.help.articles.entry-qr.title` (all 3 locales)
   - `help.help.articles.entry-qr.excerpt` (all 3 locales)
   - `help.help.articles.booking.{title,excerpt}` (all 3 locales)
   - `help.help.articles.account-login.{title,excerpt}` (all 3 locales)
   - `help.help.articles.find-qr.{title,excerpt}` (all 3 locales)
   - `help.help.articles.tier-points.{title,excerpt}` (all 3 locales)
   - `help.help.articles.cancellation-policy.{title,excerpt}` (all 3 locales)
   - `help.help.articles.special-weather.{title,excerpt}` (all 3 locales)
   - `help.help.articles.contact-support.{title,excerpt}` (all 3 locales)

2. **DB schema mismatches** (lines 1018-1041):
   - Missing table: `public.staff_nfc_cards` (admin/door routes expect it)
   - Missing column: `users.last_active_at` (admin/members routes expect it)

**Next**: Fix i18n keys (blocking SSG), then document schema issues for Phase 2

#### Fix 3: Support page i18n keys (✅ DONE)
- **Error**: `/support` page references 9 help articles with missing translation keys across 3 locales (54 keys total)
- **Root cause**: Incomplete help articles feature (registry exists but no translations)
- **Fix**: Temporarily disabled `/support` page with "Coming soon" stub (will be rebuilt properly in Phase 1)
- **Result**: Build no longer fails on missing i18n keys ✅

#### Fix 4: /member page prerendering (✅ DONE)
- **Error**: `/member` page tried to prerender during build but requires authentication
- **Fix**: Added `export const dynamic = 'force-dynamic'` to force server-side rendering
- **Result**: Build no longer fails on /member prerendering ✅

#### Build Success! (✅)
- `npm run build` passes ✅
- `npx tsc --noEmit` passes ✅

**Warnings noted (non-blocking):**
- Many admin/member/dev2 API routes log "Dynamic server usage" — expected, they all use cookies for auth
- Missing DB tables/columns (`staff_nfc_cards`, `users.last_active_at`) — expected at build time, will investigate in migration state check

---

### Phase 0.2: Migration State Investigation

**Question**: `npx supabase migration list --linked` shows only migrations 0001-0002 applied remotely, but expected tables already exist. Are migrations being applied outside the CLI?

**Answer**: YES — migrations have been applied via a different mechanism (likely MCP `apply_migration` or Supabase dashboard SQL editor).

**Evidence**:
1. CLI shows 114+ local migrations, but only 2 applied remotely
2. Query of actual schema confirms Phase 2 auth tables DO exist:
   - ✅ `account_change_requests`
   - ✅ `user_password_status`
   - ✅ `otp_phone_locks`
   - ✅ `auth_otp_policy`
   - ✅ `otp_rate_limit_events`
   - ✅ `users` table
3. Missing items confirmed:
   - ❌ `staff_nfc_cards` table (admin door routes reference it)
   - ❌ `users.last_active_at` column (admin members routes reference it)
   - ❌ `users.date_of_birth` column (needed for Phase 1 birthday feature)

**Real migration tracking mechanism**: Unknown — not the Supabase CLI's `supabase_migrations.schema_migrations` table. The CLI is out of sync with reality.

**Risk assessment**: 
- **Medium risk**: New migrations in `supabase/migrations/` may conflict with manually-applied schema
- **Action for new migrations**: Must verify schema state before applying each one
- **Phase 1/2 migrations**: 
  - `20260109_add_wallet_notify_opt_in.sql` — targets nonexistent `profiles` table, needs fixing
  - `20260924000000_add_date_of_birth.sql` — needs review before applying

---

## Phase 0 ✅ COMPLETE

### Summary
1. ✅ Fixed test imports (Jest → Vitest)
2. ✅ Fixed i18n errors (disabled incomplete `/support` page)
3. ✅ Fixed `/member` prerendering (added `force-dynamic`)
4. ✅ Confirmed build passes: `npm run build` ✅ + `npx tsc --noEmit` ✅
5. ✅ Documented migration state: CLI out of sync, real tracking mechanism unknown

### Ready for Phase 1
- Build is unblocked ✅
- Migration state understood (proceed with caution on new migrations)
- Can now begin `/member` rebuild

---

## Phase 1 — Rebuild /member (READY TO START)
