# Auth + Payment — Live Verification Handoff

This session fixed the user-blocking auth/booking bugs and realigned all
auth/member surfaces to the landing page's black + liquid-glass design.
Everything below is **build-green and pushed** (branch
`feat/booking-payment-backend`). Google sign-in is confirmed working end-to-end
(real `auth.users` created), which proves the Supabase SSR cookie + member-render
path is sound — the remaining items are isolated to their own routes/providers.

**Honest scope note:** I have no Supabase/Stripe dashboard access and no local
keys (there is no `.env*` file in the repo — secrets live only in Vercel). So I
**cannot** send a real SMS, complete a live Apple round-trip, or produce a Stripe
dashboard log from here. What I did instead — the highest-value thing possible
without keys — is **stop the code from swallowing the real provider errors**, so
your *next* live attempt shows the actual root cause instead of a generic
"please retry". Each section below says exactly what to look for.

---

## BUG 1 — SMS OTP: "无法发送验证码，请重试" (and the 502)

**Code state:** The send path no longer hides the cause, and no longer returns a
misleading 502.
- `app/api/auth/send-otp/route.ts`: on a Supabase error it logs `{message, status,
  code}` and returns the `detail` + `code` in an **HTTP 200 body with `{ ok:false
  }`** (a real 502 from an app route gets misread as a crash and its JSON body
  hidden behind an edge "Bad Gateway" page). Rate-limit still returns 429; a
  genuine thrown exception logs its stack and returns `detail` (no blank 500).
- `components/auth/AuthCard.tsx` branches on the **body's `ok`** (not `res.ok`), so
  it never advances to the OTP screen on a failed send, and renders the `detail`
  next to the friendly label.
- **E.164 verified correct in code** — the `+852` pill is display-only, the input
  holds 8 digits, and `normalizeHkPhone()` yields a clean `+852XXXXXXXX` (no
  space/separator/concatenation bug). So the failure is **provider config**, which
  the detail now reveals.

**You verify live (needs the Supabase/Twilio dashboards):**
1. Enter a number, tap continue, and **read the detail now shown in the UI** (and
   the Vercel function log line `send_otp_error`).
2. Map the detail to the fix:
   - *"Unsupported phone provider" / "phone provider … disabled"* → Supabase →
     Authentication → Providers → **enable Phone**, configure Twilio.
   - *Twilio `21608` / "unverified" / "trial"* → the Twilio account is in **trial
     mode**, which can only send to **verified** numbers. Verify the test number
     in Twilio, or upgrade the account.
   - *"invalid From / messaging service"* → Twilio Messaging Service SID / sender
     not set in Supabase's Twilio config.
3. **Confirm fixed:** OTP SMS arrives; entering it advances to the profile gate.

---

## BUG 2 — Apple Sign-In: 403 at `/appleauth/auth/oauth/authorize`

**History:** first a stale "coming soon" placeholder; then a popup-SDK attempt that
hit a **403 at Apple's own authorize endpoint** — Apple rejecting the request
before Supabase was ever reached. The popup was sending `response_type=code
id_token` (hybrid), which Apple fails on the final redirect step.

**Current fix:** dropped the JS-SDK popup entirely. `AppleSignInButton` now uses
**Supabase redirect OAuth — byte-for-byte the same call as the WORKING Google
fallback** (confirmed creating real `auth.users`):
```ts
supabase.auth.signInWithOAuth({
  provider: "apple",
  options: { redirectTo: `${SITE_URL}/auth/callback?next=${returnUrl}` },
})
```
Why this clears the 403: **Supabase** builds the authorize request server-side
using the Services ID + client-secret JWT it holds — simple `code` flow, its own
`/auth/v1/callback` as `redirect_uri`. So no hybrid `code id_token`, no nonce
requirement, and **no `client_id` is sent from the browser** (kills any
stale/cached-id concern). It travels the identical proven path Google does.

**You verify live (needs a real Apple ID + browser):**
1. Tap "Continue with Apple" → it should redirect to Apple (full page, not popup),
   show the first-time consent, and on Continue return through Supabase →
   `/auth/callback` → the profile gate / returnUrl.
2. If it still errors: confirm Apple → Services ID → Return URLs contains exactly
   `<SUPABASE_URL>/auth/v1/callback`, and Supabase → Auth → Providers → Apple has
   the Services ID + client-secret JWT (you confirmed both). Since Google works
   through the same callback, an Apple-only failure now points squarely at the
   Apple provider config, not the app code.
3. **First-login name:** Apple only sends the name on the *first* authorization.
   `/auth/callback` captures `full_name ?? name` into the `users` row, so the
   profile gate pre-fills it. (Re-test as "new" by removing the app under Apple ID
   → Sign in with Apple settings.)

---

## BUG 3 — Stripe: "couldn't start payment"

**Code state:** Every failure mode now reports specifically instead of a single
generic catch-all.
- `app/api/payment/create-intent/route.ts`: `getStripe()` +
  `paymentIntents.create()` are wrapped in their own try/catch that logs the full
  Stripe `{message, type, code, statusCode}` and returns `detail` + `code`.
- `components/checkout/StripePayment.tsx`: renders the **captured** error detail
  under the friendly label (it was previously discarded).
- Upstream specific errors already exist: `401 Unauthorized` (not signed in),
  `409` (slot lock invalid/expired), `429` (rate limited), `400`
  (zero-amount/pricing misconfig).

**You verify live (needs the Stripe test dashboard):**
1. Book a slot through to payment with test card `4242 4242 4242 4242`, any
   future expiry, any CVC.
2. **Read the detail** now shown on failure + the Vercel log
   `stripe_create_intent_error`.
   - **Logs, but Stripe Dashboard shows NO request** → the secret key is
     wrong/empty/!test-mode. Check `STRIPE_SECRET_KEY` in Vercel.
   - **Logs WITH a Stripe `type`/`code`** (e.g. `currency_not_supported`,
     `account … not activated`) → that's the cause; fix in the Stripe Dashboard.
   - **`401 Unauthorized`** → the browser session isn't reaching the server.
     `lib/supabase/server.ts` uses the standard `@supabase/ssr` cookie flow
     (verified), so this would point to a domain/cookie mismatch, not the code.
3. **Confirm fixed (per your requirement):** the test PaymentIntent appears in the
   Stripe **test-mode** Dashboard logs, and the flow reaches the confirmation
   screen with a rendered QR code.

---

## BUG 4 — `POST /api/booking/lock` → 500 (catch-all "Internal error")

**Code state:** the route no longer returns a blank 500.
- `app/api/booking/lock/route.ts`: the catch-all now logs the **full exception
  incl. `.stack`** and returns `detail`. The `find_or_lock_slot` RPC-error branch
  logs/returns PostgREST `code` + `hint` + `details`.
- `components/checkout/StripePayment.tsx` surfaces the returned `detail` (it drives
  the slot lock before the PaymentIntent).
- Verified in code: the RPC param names/order/types match migration 0004 exactly;
  `calculatePrice`, `slotBounds`, `resolveTierForUser`, `loadPeriods` are sound.

**You verify live (needs Vercel logs / Supabase):** trigger a booking lock, then
read `detail` + the `lock_error` / `find_or_lock_slot_error` log line. Map it:
- **`PGRST202`** (function not found) → migration `0004_booking_lock_and_rpcs.sql`
  isn't applied to this project, or its signature drifted. Re-run it.
- **`42703`** (undefined column) → the `slots` table is missing a column the RPC
  writes (`end_time` / `duration_hours` / `locked_by` / `locked_until` / `price`).
- **"Service Supabase client requires …"** → `SUPABASE_SERVICE_ROLE_KEY` missing in
  Vercel (this throws in `getServiceSupabase()` before the RPC → old catch-all).
- **`42883`** (function does not exist / arg mismatch) → an arg type drifted.

---

## Bonus bug found + fixed by inspection (no keys needed)

`components/auth/OtpInput.tsx` — `String.prototype.includes("")` is **always
true**, so the old completion guard `!joined.includes("")` was always false:
`onComplete()` could only fire from *paste*, never from typing the final digit by
hand. Since the OTP step has no separate submit button, **manual entry was a dead
end**. Fixed to a plain length check. (Commit `48e1cf6`.)

---

## Design realignment (done, build-green)

Extracted the real landing tokens from `app/[locale]/page.tsx` + components:
- **bg:** black · **glass:** `rgba(255,255,255,0.05)` + `backdrop-blur(20px)
  saturate(180%)` + `1px solid rgba(255,255,255,0.1)`, radius 24 · **primary
  CTA:** `#22c55e` w/ black text · **floating menus:** dark glass
  `rgba(12,12,14,0.82)` + same blur.
- **Converted:** `AuthCard`, `AuthModal`, `/login` (`LoginForm` + page → bg-black),
  booking `Screen2` card, `AccountMenu`, `SignInPrompt`, and the member dashboard
  (root → black, card → glass + tier glow, tier accents → green/amber/purple).
- Apple/Google keep their own brand button styling on the glass surface.
- No residual brass/deep-green tokens remain in any auth/member surface.
- **Back navigation unified:** the booking flow's fixed top-left back arrow was
  extracted into a single shared `components/ui/BackButton` (safe-area-aware,
  44×44, white/glass). The booking page now consumes it, and `/member` renders it
  (`href="/"`) in place of its old inconsistent chevron link — one source of
  truth, no variants.

## /login + /member routes (verified, not changed)
- `/login` exists and renders all three methods via the shared `AuthCard`.
- `/member` is `force-dynamic` and redirects unauthenticated visitors server-side:
  `getMemberData()` returns `null` (never throws) → `redirect('/login?returnUrl=
  /member')`. After login, `returnUrl` is honoured. The booking-flow login
  (`Screen2`) and `/login` share the same `AuthCard` and work independently.

---

# ROUND 3 — root causes from production auth logs

These three came from real Supabase auth-log lines (not guesses). I have **no
Supabase MCP / production DB access and no dashboard access** in this
environment, so for BUG 1 and BUG 2 the code/migration is done but the final
apply + verify is yours. BUG 3 is fully fixed in code.

## BUG 1 (P0) — new-user 500: `generate_member_code() does not exist` (42883)

**Confirmed in repo:** there is **no** `generate_member_code` / `assign_member_code`
/ auth-trigger definition anywhere in `supabase/` — `getMember.ts` even *derives*
the code client-side "when the users row has no explicit member_code column". So
the function was created in the dashboard and never committed; production lost it.

**Done:** `supabase/migrations/0005_create_generate_member_code.sql` restores it —
`248-XXXX-XXXX-C`, 8 payload chars + Luhn-mod-32 check over a 32-symbol alphabet
(2-9 + A-Z minus I/O; excludes ambiguous 0/1/I/O). Luhn logic verified in JS
(100k/100k single-char errors caught). The migration is **additive** (one
`CREATE OR REPLACE` of a pure function — drops nothing).

**You must (no DB access here):**
1. Run the 3 diagnostic queries embedded at the top of 0005 to confirm topology.
   Likely result: `assign_member_code()` (the SECURITY DEFINER fn you already
   fixed) calls `generate_member_code()` internally — which is why Google sign-in
   works through the same trigger yet new SMS/Apple users 500 on this helper.
2. Apply 0005 (`supabase db push`, or paste into the SQL Editor).
3. Re-run a full SMS OTP sign-up → confirm a `users` row is created with a
   well-formed `member_code`.
4. While there, confirm `validate_member_code` / `update_member_tier` /
   `find_or_lock_slot` / `confirm_booking` all exist (query #1) — if any are
   missing they were lost the same way and need committing too.

## BUG 2 — Apple `oauth2: "invalid_client"` at token exchange

**Verified, claim-by-claim:** the client-secret JWT generator
(`supabase/functions/rotate-apple-secret/index.ts`) is **correct** vs Apple's
spec — header `alg ES256` + `kid WC6N6LR58J`; `iss`=Team `X7DHH2944M`;
`aud`=`https://appleid.apple.com`; `sub`=Services ID `com.formhk.248snooker.web`;
`exp` ≤ 6 months. So `invalid_client` is **NOT a code/JWT-shape bug** — the secret
*currently stored in Supabase* is operationally wrong. The authorize step works
(you saw the first-time consent screen), only the code→token exchange is rejected.

**You must (Supabase + Apple dashboards — I can't reach either):** in order of
likelihood —
1. **Key ID mismatch / revoked key:** confirm the `.p8` used to mint the stored
   secret has Key ID **`WC6N6LR58J`**, and that this key still exists in Apple
   Developer → Keys (not revoked). If unsure, generate a NEW key (enable "Sign in
   with Apple", App ID `com.formhk.248snooker`), download the `.p8`, and re-mint.
2. **Re-mint the secret** with the verified generator (run the
   `rotate-apple-secret` function with `APPLE_PRIVATE_KEY` = the `.p8` contents),
   or paste a freshly generated JWT into Supabase → Auth → Providers → Apple →
   "Secret Key (for OAuth)".
3. **Provider field exactness (case-sensitive):** Services ID
   `com.formhk.248snooker.web`, Team ID `X7DHH2944M`, and the secret pasted whole
   incl. `-----BEGIN/END PRIVATE KEY-----`, no stray whitespace.
4. **Apple Services ID config:** "Sign In with Apple" enabled; Return URL =
   `https://wqmciwieiqvnswvspdyz.supabase.co/auth/v1/callback` (the **Supabase**
   URL, not 248.formhk.com); Domain = `248.formhk.com`.
5. Re-test; auth logs should no longer show `invalid_client`.

Note on the app side: Apple now uses the **same redirect OAuth as the working
Google flow** (Round 2). So once the stored secret is valid, no app change is
needed — it travels the identical proven path through `/auth/callback`.

## BUG 3 — missing `/login` → React #425/#422 + "TRY AGAIN" (FIXED in code)

**Real root cause (not a missing route):** `/login` *exists* and is correctly
non-localized (middleware `BYPASS_PREFIXES`; your acceptance URL is
`248.formhk.com/login`, no locale prefix). But the page never wrapped its tree in
`NextIntlClientProvider`, and `AuthCard` (client) calls `useTranslations` — which
**throws without that provider**, producing the #425/#422 crash both on `/login`
directly and on the OAuth-failure redirect `/login?error=...`. `/member` works
only because it has the provider.

**Done (committed, build-green):**
- `app/login/page.tsx` now wraps `NextIntlClientProvider` (mirrors the working
  `/member` pattern: `resolveLocaleFromCookie` + `loadMessages`). This is THE fix.
- Building `app/[locale]/login` would have been **wrong** — a second locale-prefixed
  login fighting the non-localized one the callback targets. Avoided.
- Wired the previously-ignored `?error` param: `/auth/callback` emits
  `missing_code` | `oauth` → mapped to CMS messages, shown in a styled alert.
- Added the `login` namespace (brand/title/subtitle + 3 error messages) to all 4
  locales. `LoginForm` reads brand/title from CMS (were hardcoded).
- Verified `/book` `Screen2` already reuses the same shared `AuthCard` — no
  duplicated login code (acceptance item satisfied).

**You verify:** hit `https://248.formhk.com/login` (no crash), and force an OAuth
failure → `/login?error=oauth` shows the localized message instead of #425/#422.

## Round-3 acceptance checklist
- [ ] (BUG1, needs you) Apply migration 0005; new SMS user creates a `users` row
      with a valid `member_code`; no more 42883 / "Database error saving new user".
- [ ] (BUG2, needs you) Re-mint/fix the Apple secret in Supabase; auth logs clear
      of `invalid_client`; Apple sign-in completes through `/auth/callback`.
- [x] (BUG3, done) `/login` renders without #425/#422; `?error=` shows a localized
      message; `/book` reuses the shared login component.

---

## The one item legitimately blocked on a human
**Apple/Google Wallet badge art** must be downloaded from
`developer.apple.com/wallet/` and Google's Wallet brand page — binary assets I
can't fetch. The "Add to Apple/Google Wallet" buttons render as styled
placeholders until those official assets are dropped in.
