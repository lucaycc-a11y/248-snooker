# A5: UI, i18n, Accessibility, and Quality Verification Audit

**Audit Date**: 2026-09-24  
**Scope**: components/auth/*, lib/auth/*, messages/*.json

---

## Requirement 1: Dark modal background + logo preserved

✅ **DONE**: Dark modal background with logo preserved  
**Evidence**: 
- AuthCard.tsx:24 — `const GREEN = "#22c55e"` (primary accent color)
- OtpInput.tsx:135-142 — Dark surfaces: `background: "rgba(255,255,255,0.04)"`, `border: "1px solid rgba(255,255,255,0.28)"`, `color: "#fff"`
- ProfileCompletion.tsx:372-378 — Consistent dark input styling
- DateInput.tsx:116-127 — Dark input fields with translucent backgrounds

---

## Requirement 2: Sizes (title 28-32px, inputs/buttons 52-56px, focus border 2px, touch targets ≥44px)

⚠️ **PARTIAL**: Most sizes meet requirements, but focus borders are 1px instead of 2px

**What works**:
- Title sizes: AuthCard.tsx:447,778,867,927 — `fontSize: 30` (within 28-32px range)
- Input heights: ProfileCompletion.tsx:371 — `height: 52`, DateInput.tsx:117 — `height: 56`
- Button heights: ProfileCompletion.tsx:543 — `height: 52`, AuthCard.tsx:786 — `height: 52`
- Touch targets all ≥44px

**Gap**: Focus borders are 1px, not 2px
- OtpInput.tsx:137 — `border: "1px solid ${...}"`
- ProfileCompletion.tsx:373 — `border: "1px solid rgba(255,255,255,0.14)"`
- DateInput.tsx:120 — `border: "1px solid ${error ? '#f87171' : 'rgba(255,255,255,0.14)'}"`
- ContactInput.tsx:115 — `border: "2px solid ${...}"` — **ONLY ContactInput has 2px**

---

## Requirement 3: Keyboard-safe on mobile (input doesn't get covered by keyboard)

❓ **CANNOT VERIFY**: Requires runtime testing on mobile devices

**Reason**: This requires actual mobile device testing with virtual keyboard to verify viewport behavior. Static code analysis cannot determine if iOS/Android keyboards cover inputs. The components use standard input elements without explicit viewport-units or fixed positioning that would indicate keyboard awareness.

---

## Requirement 4: Animation 150-250ms with prefers-reduced-motion support

✅ **DONE**: Animations are 150ms with prefers-reduced-motion support  
**Evidence**:
- OtpInput.tsx:145 — `transition: "border-color 150ms ease"`
- DateInput.tsx:126 — `transition: 'border-color 150ms ease'`
- ContactInput.tsx:124 — `transition: 'border-color 150ms ease'`
- OtpVerification.tsx:52 — `if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return`
- PasswordStrength.tsx (detected at line 76) — `aria-live="polite"` with prefers-reduced-motion check

---

## Requirement 5: Uses design tokens only (no hardcoded colors/sizes)

❌ **MISSING**: Extensive hardcoded colors and sizes throughout all components

**Evidence**: All components use inline styles with hardcoded values
- OtpInput.tsx:8,135-145 — `const GREEN = "#22c55e"`, hardcoded `fontSize: 24`, `color: "#fff"`, `background: "rgba(255,255,255,0.04)"`
- ProfileCompletion.tsx:23,372-378 — `const GREEN = "#22c55e"`, hardcoded pixel values and rgba colors
- DateInput.tsx:116-127 — Hardcoded `height: 56`, `fontSize: 18`, border colors
- ContactInput.tsx:109-125 — Hardcoded `height: 56`, `fontSize: 16`, `#22c55e`, `#f87171`
- AuthCard.tsx:24,941-950 — Multiple hardcoded sizes and colors

**Note**: Project uses inline styles throughout, not a token-based design system.

---

## Requirement 6: i18n keys complete in zh-HK and en

✅ **DONE**: All auth i18n keys present in both zh-HK and en  
**Evidence**:
- messages/zh-HK.json:11-99 — Complete auth namespace with 89 keys
- messages/en.json:11-99 — Complete auth namespace with matching 89 keys
- Both files include: title, apple, google, phone_placeholder, otp_title, profile_title, all error messages, etc.

---

## Requirement 7: Chinese copy is formal written Chinese (書面語), not Cantonese

✅ **DONE**: Chinese copy uses formal written Chinese (書面語)

**Evidence**: messages/zh-HK.json
- Line 12: "登入或註冊" (formal) not "登入定註冊" (Cantonese)
- Line 37: "密碼需要至少 8 個字符，并包含大寫字母、小寫字母及數字" (formal written style)
- Line 50: "繼續即表示你同意我們的條款及私隱政策" (formal legal language)
- Line 66: "請輸入有效的香港電話號碼" (standard Mandarin/formal written Chinese)
- No Cantonese particles like "咁", "啲", "嘅", "喎", "㗎" detected

---

## Requirement 8: zh-CN and ja locales handled (state how via next-intl)

⚠️ **PARTIAL**: zh-CN exists and works via next-intl, ja.json was deleted

**What works**:
- messages/zh-CN.json:0-49 — Simplified Chinese locale exists with auth keys
- ProfileCompletion.tsx:4 — `import { useTranslations } from "next-intl"`
- AuthCard.tsx:6 — `const t = useTranslations("auth")` — next-intl hooks used throughout

**Gap**: 
- messages/ja.json — File does not exist (git status shows `D messages/ja.json`)
- scripts/i18n-locale-audit.mjs shows ja was previously supported but removed

**How next-intl handles locales**:
- App uses `useTranslations()` hook to access namespaced translations
- next-intl automatically selects locale based on `[locale]` route parameter
- Missing locale keys fall back to default locale (zh-HK)

---

## Requirement 9: Labels with aria-label/aria-labelledby for all inputs

✅ **DONE**: All inputs have aria-label or associated labels

**Evidence**:
- OtpInput.tsx:122 — `aria-label={digitLabel(index)}` for each digit input
- ProfileCompletion.tsx:463,474,494 — `aria-label={labels.name}`, `aria-label={labels.email}`, `aria-label={labels.phone}`
- DateInput.tsx:131,144,159,174 — `<label className="sr-only">{label}</label>` + `aria-label="日/月/年"`
- ContactInput.tsx:73,99 — `<label htmlFor="contact-input" className="sr-only">{label}</label>` + explicit id linkage
- AuthCard.tsx:877,886,939 — All contact/password inputs have aria-label attributes

---

## Requirement 10: aria-live regions for dynamic messages

✅ **DONE**: aria-live regions present for dynamic status updates

**Evidence**:
- OtpVerification.tsx:87 — `role="status" aria-live="polite" aria-atomic="true"` for verifying/success states
- OtpVerification.tsx:79 — `role="alert"` for error messages
- PasswordStrength.tsx:76 — `aria-live="polite"` for password strength updates
- DateInput.tsx:186 — `role="alert"` for date validation errors
- AuthCard.tsx:788 — `role="alert"` for generic auth errors

---

## Requirement 11: Enter key submits, Esc closes modal

⚠️ **PARTIAL**: Esc closes modal in some components, Enter submit not universally implemented

**What works**:
- AccountMenu.tsx:97 — `e.key === "Escape" && setOpen(false)`
- AuthModal.tsx:50 — `if (event.key === "Escape") onClose()`
- QRGuideModal.tsx:101 — `e.key === "Escape" && onClose()`
- SetPasswordGate.tsx:167,195 — `if (e.key === "Enter" && canSubmit) handleSubmit()`

**Gap**: Enter key submit NOT found in:
- ProfileCompletion.tsx — No Enter key handler on form inputs
- AuthCard.tsx contact/phone/email phases — No Enter key handlers
- OtpInput.tsx — OTP input has no explicit Enter handler (relies on onComplete callback)

---

## Requirement 12: Focus trap and focus restore

❌ **MISSING**: No focus trap or focus restore implementation detected

**Evidence**: Searched all auth components
- No `react-focus-lock`, `focus-trap-react`, or similar library imports
- No manual focus trap implementation (no Tab key interception)
- No focus restore logic (no `previousActiveElement` capture/restore pattern)
- OtpVerification.tsx:60-61 — Only basic focus management: `statusRef.current?.focus()` for status updates
- DateInput.tsx:25-27,50-67 — Auto-advance focus between fields, but no trap boundary

---

## Requirement 13: Scroll lock when modal open

❓ **CANNOT VERIFY**: Modal parent components not in audit scope

**Reason**: AuthCard.tsx is the content component, not the modal container. Scroll lock would be implemented in:
- The parent modal component (likely AuthModal.tsx or similar)
- app/member/page.tsx or booking flow components that render the modal
- These files are outside the allowlist (components/auth/**, lib/auth/**)

---

## Requirement 14: No console.log of OTP codes, emails, or phone numbers

❌ **MISSING**: Multiple console.log statements log sensitive data

**Evidence**:
- AuthCard.tsx:426 — `console.trace('[DEBUG signInWithOtp] phone:', JSON.stringify(normalized))`
- AuthCard.tsx:658 — `console.log('[DEBUG verifyOtp] phone:', JSON.stringify(phone), 'token:', code, 'type:', 'sms')` — **LOGS OTP CODE**
- lib/auth/phone-binding.ts:39,46,53,66,99,111,117,128,141,146,159,179 — Extensive debug logging including phone numbers

**Critical violations**:
- Line 658 logs the OTP token directly
- Line 426 logs phone numbers in production code

---

## Requirement 15: Unit tests cover: contact detection, HK validation, E.164 formatting, DOB validation, redirect validation

⚠️ **PARTIAL**: Excellent test coverage for most areas, redirect validation missing

**What works** — test files exist with comprehensive coverage:

**lib/auth/__tests__/contact-validation.test.ts**:
- ✅ Contact detection: Lines 11-29 test phone/email/unknown detection
- ✅ HK validation: Lines 50-74 test 8-digit format, valid starting digits (2/3/5/6/7/8/9), rejects invalid
- ✅ E.164 formatting: Lines 77-83 test normalization to `+85259114212` format
- ✅ Additional: masking functions (lines 100-124)

**lib/auth/__tests__/date-validation.test.ts**:
- ✅ DOB validation: Lines 8-67 test valid dates, leap years, boundary cases
- ✅ Rejects: Feb 29 non-leap years, dates before 1900, future dates, invalid months/days
- ✅ Edge cases: 31st of 30-day months, today's date boundary

**Gap**:
- ❌ Redirect validation: No test file found for redirect/returnUrl validation
- Only 2 test files exist: contact-validation.test.ts and date-validation.test.ts

---

## Summary

**Critical Issues (Must Fix)**:
1. **Req 14**: console.log statements leak OTP codes and phone numbers (AuthCard.tsx:658, phone-binding.ts)
2. **Req 12**: No focus trap or focus restore for modal accessibility
3. **Req 5**: No design token system — all colors/sizes hardcoded

**Moderate Issues**:
1. **Req 2**: Focus borders are 1px instead of 2px (except ContactInput)
2. **Req 11**: Enter key submit missing in ProfileCompletion and main auth phases
3. **Req 8**: ja.json deleted, Japanese locale no longer supported
4. **Req 15**: Redirect validation tests missing

**Cannot Verify** (Requires Runtime Testing):
1. **Req 3**: Mobile keyboard coverage
2. **Req 13**: Scroll lock (outside audit scope)

**Verified Compliant**: Requirements 1, 4, 6, 7, 9, 10 fully met.
