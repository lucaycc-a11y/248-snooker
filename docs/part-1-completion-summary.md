# Part 1 — Send SMS Hook Adapter ✅ COMPLETED

## Summary

Successfully implemented the Supabase Send SMS Hook adapter that forwards Supabase-generated OTP codes to Engagelab for SMS/WhatsApp delivery.

## Files Created

✅ **[lib/engagelab/send-hook.ts](lib/engagelab/send-hook.ts)**
- `sendSupabaseOtpViaEngagelab()` — Sends Supabase OTP via Engagelab template with custom `{{code}}` variable
- `verifySupabaseHookSignature()` — HMAC-SHA256 webhook signature verification
- Full TypeScript types and error handling

✅ **[app/api/auth/hooks/send-sms/route.ts](app/api/auth/hooks/send-sms/route.ts)**
- HTTP POST endpoint for Supabase Send SMS Hook
- Signature verification (prevents spoofing attacks)
- Structured logging for audit trail
- Error mapping from Engagelab to user-friendly messages

✅ **[scripts/test-send-sms-hook.ts](scripts/test-send-sms-hook.ts)**
- Comprehensive test suite
- Tests valid requests, invalid signatures, missing signatures
- Simulates Supabase webhook signing

✅ **[docs/supabase-phone-auth-migration.md](docs/supabase-phone-auth-migration.md)**
- Complete migration guide covering all 5 parts
- Step-by-step instructions with verification checklists
- Troubleshooting guide and rollback plan

## Environment Variables Added

```bash
# .env.local (already updated)
SUPABASE_AUTH_HOOK_SECRET=""           # Webhook signing secret
ENGAGELAB_SUPABASE_TEMPLATE_ID=""      # Template with {{code}} variable
```

## TypeScript Compilation

✅ **Passed** — No new TypeScript errors introduced (existing error in checkout/create/route.ts is unrelated)

## Security Features

✅ **HMAC-SHA256 Signature Verification** — Prevents unauthorized SMS sending
✅ **Constant-time Comparison** — Prevents timing attacks
✅ **Structured Logging** — Audit trail for all hook invocations
✅ **Phone Number Masking** — Last 4 digits masked in logs for privacy

## Next Steps for Luca

Before testing Part 1, you **MUST** complete these setup steps:

### 1. Generate Webhook Secret
```bash
openssl rand -base64 32
```
Add the output to `.env.local`:
```bash
SUPABASE_AUTH_HOOK_SECRET="<generated-secret>"
```

### 2. Create Engagelab Template

Log into [Engagelab Dashboard](https://console.engagelab.com/) and create:

**Template Configuration:**
- **Name:** `Supabase OTP`
- **Content (zh_HK):** `【Space8】您的驗證碼是{{code}}，5分鐘內有效。請勿將驗證碼告知他人。`
- **Variables:** `code` (this will receive the Supabase-generated OTP)
- **Verification:** ❌ DISABLED (Supabase handles verification, not Engagelab)

Copy the template ID and add to `.env.local`:
```bash
ENGAGELAB_SUPABASE_TEMPLATE_ID="<template-id>"
```

### 3. Test Locally

```bash
# Start dev server
npm run dev

# In another terminal, run tests
npx tsx scripts/test-send-sms-hook.ts
```

**Expected Results:**
- ✅ Test 1: Valid request succeeds, SMS delivered
- ✅ Test 2: Invalid signature rejected with 401
- ✅ Test 3: Missing signature rejected with 401

**Check your phone** for an SMS containing: `【Space8】您的驗證碼是123456，5分鐘內有效。`

## Architecture Diagram

```
┌────────────────────────────────────────────────────��────────┐
│ User requests phone OTP                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend: supabase.auth.signInWithOtp({ phone })            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase: Generates 6-digit OTP, stores in auth.sessions   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Supabase: POST to /api/auth/hooks/send-sms                 │
│ Headers: x-supabase-signature (HMAC-SHA256)                │
│ Body: { user: { phone }, sms: { otp } }                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Our Hook: Verify signature, forward to Engagelab           │
│ lib/engagelab/send-hook.ts                                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ Engagelab: Send SMS/WhatsApp with custom OTP code          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ User receives SMS: "【Space8】您的驗證碼是123456，5分鐘內有效"  │
└─────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### Why Template with Variables (Not Custom Content)?

Engagelab's OTP API has two modes:
1. **Template-based** — Template defines content, API generates OTP
2. **Custom content** — API sends arbitrary text (NOT available for OTP endpoint)

For Supabase integration, we use **template with variables**:
- Template: `【Space8】您的驗證碼是{{code}}，5分鐘內有效`
- Variable: `code` = Supabase-generated OTP
- This preserves Engagelab's SMS optimization while using Supabase's OTP

### Why Disable Engagelab Verification?

- **Supabase verifies the OTP** via `auth.verifyOtp()`
- Engagelab doesn't need to track verification state
- This is just an SMS delivery adapter, not a verification system

### Security: Why Signature Verification?

Without signature verification, anyone could:
1. Find the public `/api/auth/hooks/send-sms` endpoint
2. POST arbitrary phone numbers and messages
3. Drain your SMS credits
4. Send spam via your Engagelab account

HMAC-SHA256 signature proves the request came from Supabase, not an attacker.

## Differences from Old System

| Aspect | Old System | New System (Part 1) |
|--------|-----------|---------------------|
| OTP Generation | App generates code | Supabase generates code |
| Storage | `whatsapp_otps` table | `auth.sessions` (Supabase internal) |
| SMS Trigger | Direct Engagelab call | Via Supabase hook |
| Verification | Custom RPC | Not yet (Part 4) |
| Security | reCAPTCHA + rate limit | Hook signature + Supabase rate limit |

## What's NOT Changed Yet

❌ Frontend still calls `/api/otp/send` (Part 4 changes this)
❌ Old `whatsapp_otps` table still exists (Part 5 removes it)
❌ Users don't use the new system yet (Part 4 activates it)

Part 1 only implements the **adapter layer**. The frontend migration happens in Part 4.

## Verification Checklist for Part 1

Before proceeding to Part 2:

- [ ] `SUPABASE_AUTH_HOOK_SECRET` is set in `.env.local`
- [ ] `ENGAGELAB_SUPABASE_TEMPLATE_ID` is set in `.env.local`
- [ ] Engagelab template exists with `{{code}}` variable
- [ ] Test script runs successfully (3/3 tests pass)
- [ ] SMS received on test phone with correct OTP format
- [ ] Invalid signature test returns 401 (security works)
- [ ] Logs show `send_sms_hook.success` events

## Ready for Part 2

Once Part 1 is verified, proceed to Part 2 in [docs/supabase-phone-auth-migration.md](docs/supabase-phone-auth-migration.md#part-2-supabase-dashboard-configuration).

---

**Status:** ✅ Implementation complete, awaiting configuration and testing
**Blocker:** None — ready for Luca to configure webhook secret and Engagelab template
**Risk:** Low — isolated adapter, doesn't affect existing phone auth flow
