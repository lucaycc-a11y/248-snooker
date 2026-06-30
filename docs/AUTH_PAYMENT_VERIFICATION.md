# Auth + Payment — Live Verification Handoff

This session fixed three "user-blocking" bugs and realigned all auth/member
surfaces to the landing page's black + liquid-glass design. Everything below is
**build-green and pushed** (branch `feat/booking-payment-backend`).

**Honest scope note:** I have no Supabase/Stripe dashboard access and no local
keys (there is no `.env*` file in the repo — secrets live only in Vercel). So I
**cannot** send a real SMS, complete a live Apple round-trip, or produce a Stripe
dashboard log from here. What I did instead — the highest-value thing possible
without keys — is **stop the code from swallowing the real provider errors**, so
your *next* live attempt shows the actual root cause instead of a generic
"please retry". Each section below says exactly what to look for.

---

## BUG 1 — SMS OTP: "无法发送验证码，请重试"

**Code state:** The send path no longer hides the cause.
- `app/api/auth/send-otp/route.ts` logs `{message, status, code}` from Supabase's
  `signInWithOtp` and returns `detail` + `code` to the client.
- `components/auth/AuthCard.tsx` renders that `detail` next to the friendly label.
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

## BUG 2 — Apple Sign-In showed "即将推出 (Coming Soon)"

**That screenshot was stale.** The "coming soon" placeholder was removed earlier
this session. Apple is now wired for real, exactly as requested:
- `components/auth/AppleSignInButton.tsx` loads Apple's official `appleid.auth.js`,
  calls `AppleID.auth.init({ clientId: 'com.formhk.248snooker.web', scope: 'name
  email', redirectURI, usePopup: true })`, then on click
  `AppleID.auth.signIn({ nonce })` → `supabase.auth.signInWithIdToken({ provider:
  'apple', token: id_token, nonce })` → in-place sign-in (no full-page redirect).
- **Automatic fallback** to Supabase redirect OAuth if the SDK can't load or the
  popup errors (for anything other than user-cancel) — never a dead path.

**You verify live (needs a real Apple ID + browser):**
1. Tap "Continue with Apple". A popup should appear.
2. If it errors with `invalid_redirect` / `invalid_request`: the popup's
   `redirectURI` (`<SUPABASE_URL>/auth/v1/callback`, derived from
   `NEXT_PUBLIC_SUPABASE_URL`) must be in the Apple Services ID's **Return URLs**.
   You said the Supabase callback is already registered — if so this just works;
   if not, add that exact URL. Either way, the redirect fallback covers it.
3. **Confirm fixed:** sign-in completes and lands on the profile gate / returnUrl.
4. **First-login name:** Apple only sends the user's name on the *first*
   authorization. `/auth/callback` already captures `full_name ?? name` into the
   `users` row, so the profile gate pre-fills it. (To re-test as a "new" user,
   remove the app under Apple ID → Sign in with Apple settings.)

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

## /login + /member routes (verified, not changed)
- `/login` exists and renders all three methods via the shared `AuthCard`.
- `/member` is `force-dynamic` and redirects unauthenticated visitors server-side:
  `getMemberData()` returns `null` (never throws) → `redirect('/login?returnUrl=
  /member')`. After login, `returnUrl` is honoured. The booking-flow login
  (`Screen2`) and `/login` share the same `AuthCard` and work independently.

---

## The one item legitimately blocked on a human
**Apple/Google Wallet badge art** must be downloaded from
`developer.apple.com/wallet/` and Google's Wallet brand page — binary assets I
can't fetch. The "Add to Apple/Google Wallet" buttons render as styled
placeholders until those official assets are dropped in.
