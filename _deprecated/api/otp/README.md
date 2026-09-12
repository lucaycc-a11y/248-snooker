# Deprecated OTP System

**Deprecated on:** 2026-09-12  
**Reason:** Migrated to Supabase native Phone Auth + Send SMS Hook

---

## What was deprecated

This directory contains the old custom OTP system that used:
- `whatsapp_otps` table in Supabase
- Custom RPCs: `reserve_login_otp`, `complete_login_otp`, `verify_login_otp`
- Engagelab direct integration for SMS sending

## Why it was deprecated

The custom system had several persistent bugs:
1. **Type mismatch bug** - `complete_login_otp` returned a table `[{ok, reason}]` but code checked `completed !== true`, causing all OTP sends to fail
2. **Rate limit refund issues** - Rate limits were not properly refunded on certain error paths
3. **reCAPTCHA race conditions** - Timing issues between reCAPTCHA validation and OTP generation

## What replaced it

**Supabase Native Phone Auth** with:
- Built-in OTP generation, validation, and expiry
- Send SMS Hook forwarding to Engagelab
- Native rate limiting
- Integrated reCAPTCHA support

Benefits:
- ✅ Eliminates entire class of custom RPC bugs
- ✅ Unified auth flow (email and phone use same Supabase APIs)
- ✅ Better security (Supabase handles validation logic)
- ✅ Simpler codebase (thin adapter instead of full custom system)

## Migration details

See [docs/otp-migration-progress.md](../../docs/otp-migration-progress.md) for full migration documentation.

### Files in this directory

- **send-route.ts** - Original `/api/otp/send` endpoint (Part 0 emergency fix applied)
- **verify-route.ts** - Original `/api/otp/verify` endpoint
- **verify-binding-route.ts** - Original `/api/otp/verify-binding` endpoint

### Database objects (retained for now)

The following database objects are **still in the database** but no longer used:

**Table:**
- `whatsapp_otps` - OTP storage (will be dropped after 7 days of stable operation)

**RPCs:**
- `reserve_login_otp` - Reserve an OTP slot with rate limiting
- `complete_login_otp` - Mark OTP as sent (had the type mismatch bug)
- `verify_login_otp` - Verify OTP code

**Drop plan:** After Supabase Phone Auth runs stably in production for 7+ days with no login issues, Luca will manually drop these objects.

## Can this be restored?

**Yes, temporarily.** If the new system has critical issues:

1. Restore files from this directory back to `app/api/otp/`
2. Revert frontend changes in [AuthCard.tsx](../../components/auth/AuthCard.tsx)
3. The database objects (`whatsapp_otps` table, RPCs) are still intact

However, **Part 0's emergency fix** should remain - it fixes the type mismatch bug that was preventing logins.

## Timeline

- **Part 0** (2026-09-12): Emergency fix for `completed !== true` bug - deployed immediately
- **Part 1** (2026-09-12): Send SMS Hook adapter created
- **Part 3** (2026-09-12): Backfilled 7 users' phones to `auth.users.phone`
- **Part 4** (2026-09-13): Frontend migrated to Supabase native auth
- **Part 5** (2026-09-13): Old system moved to `_deprecated/`

---

**Do not delete this directory until:**
- [ ] New system runs stably for 7+ days
- [ ] No user-reported login issues
- [ ] Luca confirms database objects can be dropped
