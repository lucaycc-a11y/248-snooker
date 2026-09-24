# A3 OTP Step Verification Report

## Requirement 1: OTP input length follows backend (currently 6, never hardcoded 4)
✅ **DONE** — Evidence: components/auth/AuthCard.tsx:25 `const OTP_LENGTH = 6`, components/auth/OtpInput.tsx:11 `length = 6` parameter, and OtpVerification.tsx:21 receives `length: number` as a prop. The length is configurable and set to 6 throughout.

## Requirement 2: Input attributes (autocomplete, inputmode, pattern)
✅ **DONE** — Evidence: components/auth/OtpInput.tsx:117-119
- `inputMode="numeric"` (line 117)
- `pattern="[0-9]*"` (line 118)
- `autoComplete={index === 0 ? "one-time-code" : "off"}` (line 119)

## Requirement 3: Autofocus on mount
✅ **DONE** — Evidence: components/auth/OtpInput.tsx:37-39
```typescript
useEffect(() => {
  if (focusFirst) refs.current[0]?.focus()
}, [focusFirst])
```
And OtpVerification.tsx:76 passes `focusFirst={status === "input"}` to OtpInput.

## Requirement 4: Paste support (entire code at once)
✅ **DONE** — Evidence: components/auth/OtpInput.tsx:103-106
```typescript
const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
  event.preventDefault()
  setCode(0, event.clipboardData.getData("text"))
}
```
And line 128: `onPaste={handlePaste}` binds the handler to each input.

## Requirement 5: Auto-submit when complete
✅ **DONE** — Evidence: components/auth/OtpInput.tsx:41-45
```typescript
const completeIfReady = (next: string[]) => {
  if (!slots.every((digit) => digit.length === 1) && next.every((digit) => digit.length === 1)) {
    onComplete?.(next.join(""))
  }
}
```
Called in setSlots (line 50) whenever digits change.

## Requirement 6: Backspace navigates to previous digit
✅ **DONE** — Evidence: components/auth/OtpInput.tsx:84-93
```typescript
if (event.key === "Backspace") {
  event.preventDefault()
  const next = [...slots]
  if (next[index]) {
    next[index] = ""
    onChange(next)
  } else if (index > 0) {
    next[index - 1] = ""
    setSlots(next, index - 1)
  }
}
```

## Requirement 7: Target (email/phone) shown but masked
⚠️ **PARTIAL** — Evidence: components/auth/AuthCard.tsx:822-827 displays the full phone/email
```typescript
{otpChannel === "email"
  ? t("otp_subtitle_email", { email })
  : otpDeliveryChannel === "whatsapp"
    ? t("otp_subtitle_whatsapp", { phone })
    : t("otp_subtitle", { phone })}
```
The i18n strings (messages/en.json:54, 81-82) show:
- `"otp_subtitle": "We sent a 6-digit code to {phone}"`
- `"otp_subtitle_email": "We sent a 6-digit code to {email}"`
- `"otp_subtitle_whatsapp": "We sent a 6-digit code to +852 {phone} on WhatsApp"`

Gap: No masking applied — email and phone are shown in full. The requirement specifies masking like "59****12" or "te**@example.com".

## Requirement 8: Resend button with 30-second countdown
⚠️ **PARTIAL** — Evidence: components/auth/AuthCard.tsx:26 `const RESEND_COOLDOWN = 60` and lines 842-850
```typescript
<button
  type="button"
  onClick={otpChannel === "email" ? sendEmailOtp : sendOtp}
  disabled={cooldown > 0 || busy}
  ...
>
  {cooldown > 0 ? t("resend_in", { seconds: cooldown }) : t("resend")}
</button>
```

Gap: The countdown is 60 seconds, not 30 as required.

## Requirement 9: Hourly resend limit message shown when hit
❌ **MISSING** — Evidence: searched components/auth/AuthCard.tsx:364-531 (sendContactOtp, sendOtp, sendEmailOtp functions) and lib/auth/otp-errors.ts. The code handles rate limiting with `err_rate_limited` message (messages/en.json:74), but this is a generic "Too many attempts. Please wait a few minutes." message, not an hourly limit indicator. No specific hourly limit tracking or message is implemented.

## Requirement 10: "More options" bottom sheet present
❌ **MISSING** — Evidence: searched components/auth/AuthCard.tsx and OtpVerification.tsx. No "More options" UI element, bottom sheet, or alternative contact method switcher found in the OTP phase.

## Requirement 11: Back arrow preserves input from identify step
✅ **DONE** — Evidence: components/auth/AuthCard.tsx:811-818
```typescript
<button
  type="button"
  onClick={() => { setPhase("methods"); setError(null); setOtpStatus("input") }}
  ...
>
  <ChevronLeft size={16} /> {t("back")}
</button>
```
The `contact`, `phone`, and `email` state variables are NOT cleared when going back, only `error` and `otpStatus` are reset. The input is preserved.

## Requirement 12: Inline error messages (no red popup modal), shake animation, auto-clear on error
⚠️ **PARTIAL** — Evidence:
- Inline errors: ✅ OtpVerification.tsx:78-81 renders error inline as `<p id={errorId} className="otp-verification-error" role="alert">` — no modal.
- Auto-clear on error: ✅ OtpVerification.tsx:80 provides a "Try again" button that calls `onReset`, which clears the error (AuthCard.tsx:837 `onReset={() => { setOtp(...); setError(null); setOtpStatus("input") }}`).
- Shake animation: ❌ No shake animation found. Searched for CSS classes with "shake", "animate", or framer-motion variants in OtpVerification.tsx and AuthCard.tsx — none present.

Gap: Missing shake animation on error.

## Requirement 13: Expired code message
✅ **DONE** — Evidence: OtpVerification.tsx:63-69
```typescript
const effectiveStatus = status === "input" && remainingSeconds === 0 ? "expired" : status
...
const displayError = effectiveStatus === "expired" ? t("err_otp_expired") : ...
```
And messages/en.json:76 defines `"err_otp_expired": "Code expired. Request a new one."`. The component tracks expiration via `expiresAt` prop (line 29) and automatically switches to expired status when the timer reaches zero.

## Requirement 14: Rate-limit message
✅ **DONE** — Evidence: lib/auth/otp-errors.ts:161-168 maps rate-limit errors
```typescript
if (msg.includes('rate limit') || msg.includes('too many')) {
  return {
    type: 'rate_limited',
    message: t('err_rate_limited'),
    ...
  }
}
```
And messages/en.json:74 defines `"err_rate_limited": "Too many attempts. Please wait a few minutes."`. The error is displayed inline via OtpVerification.tsx:79.

---

## Summary
- **8 DONE** (requirements 1, 2, 3, 4, 5, 6, 11, 13, 14)
- **3 PARTIAL** (requirements 7, 8, 12)
- **2 MISSING** (requirements 9, 10)

### Critical Gaps
1. **Req 7**: No contact masking (security risk — exposes full email/phone)
2. **Req 8**: 60-second cooldown instead of 30
3. **Req 9**: No hourly resend limit indicator
4. **Req 10**: No "More options" bottom sheet
5. **Req 12**: No shake animation on error

### Note on "More options" (Requirement 10)
The constraints section asked to check what "More options" contains (WhatsApp visibility rule). Since the bottom sheet is entirely missing, this check cannot be performed. If implemented, it should likely show:
- Switch to email/phone (alternate contact method)
- WhatsApp delivery option (if applicable for phone)
- Contact support link
