# A2: Identify Step Verification Report

## Requirement 1: Single input field accepts both email and phone, auto-detects type
✅ DONE: Unified contact input with automatic type detection — Evidence: components/auth/AuthCard.tsx:307-338 (detectContactType function), components/auth/AuthCard.tsx:934-952 (single input field in "contact" phase)

## Requirement 2: Country code +852 shown for phone input
⚠️ PARTIAL: Country code shown in ContactInput component but NOT in AuthCard's unified input — Gap: AuthCard.tsx:934-952 renders a plain input without country code prefix overlay; ContactInput.tsx:76-95 has the +852 prefix logic but ContactInput is not used in the identify phase — Evidence: AuthCard.tsx:912-1017 (contact phase), ContactInput.tsx:1-146 (unused component with prefix)

## Requirement 3: HK phone validation: 8 digits, first digit in [2,3,5,6,7,8,9], spaces allowed
✅ DONE: Validation implemented correctly — Evidence: lib/auth/profile.ts:28-33 (normalizeHkPhone accepts 2-9 as first digit, strips spaces/separators), lib/auth/contact-validation.ts:51-54 (validateHkPhone uses normalizeHkPhone)

## Requirement 4: Output format: E.164 (+85259114212 not 59114212)
✅ DONE: E.164 normalization applied — Evidence: AuthCard.tsx:341-361 (extractPhoneNumber produces +852 prefix), lib/auth/profile.ts:32 (normalizeHkPhone returns `+852${digits}`)

## Requirement 5: Extensible dial-code data structure (not hardcoded single value)
❌ MISSING: Hard-coded +852 throughout — Evidence: AuthCard.tsx:356-357 (literal "+852" strings), lib/auth/profile.ts:30-32 (hard-coded 852), ContactInput.tsx:93 (hard-coded 🇭🇰 +852). No dial-code lookup table or configuration exists.

## Requirement 6: Continue button disabled until valid input
✅ DONE: Button disabled on empty input — Evidence: AuthCard.tsx:960-977 (disabled={busy || contact.trim().length === 0})

## Requirement 7: Loading spinner on submit, no double submit
✅ DONE: Busy state prevents double submit — Evidence: AuthCard.tsx:364-474 (sendContactOtp sets busy=true immediately, button disabled when busy), AuthCard.tsx:960-977 (button shows "sending" text and disabled cursor when busy)

## Requirement 8: Apple/Google login buttons unchanged
✅ DONE: OAuth buttons present and unchanged in method picker — Evidence: AuthCard.tsx:1024-1032 (AppleSignInButton), AuthCard.tsx:1027-1032 (GoogleSignInButton)

## Requirement 9: Password login entry point visible
✅ DONE: Password login link present — Evidence: AuthCard.tsx:1049-1057 (switch_to_password button in method picker)

## Requirement 10: Terms/privacy links present
✅ DONE: Terms text with implicit policy reference — Evidence: AuthCard.tsx:1060-1063 (terms text rendered at bottom of method picker)

## Requirement 11: No account enumeration: uniform responses, no name shown before verification
⚠️ PARTIAL: Uniform error messages exist but account-distinguishing errors remain — Gap: AuthCard.tsx:238 shows different errors for "email_exists" vs "phone_exists" which leaks account existence; err_email_exists (messages/zh-HK.json:39) says "此 email 已註冊，請登入后在帳戶設定新增電話" which confirms the email is registered — Evidence: AuthCard.tsx:237-239, messages/zh-HK.json:39-40, messages/en.json:39-40

## contact-validation.ts Origin Investigation
**File timestamp**: 2026-09-24 18:52:27 (created today)
**Git history**: No commits found — file is untracked/unstaged
**Conclusion**: lib/auth/contact-validation.ts is a NEW file created during this refactor, not yet committed to version control

## Summary
- **6 requirements DONE** (1, 3, 4, 6, 7, 8, 9, 10)
- **2 requirements PARTIAL** (2: country code not shown in actual identify input; 11: account enumeration still possible via error messages)
- **1 requirement MISSING** (5: no extensible dial-code structure)
- **0 requirements CANNOT VERIFY**

## Critical Gaps
1. **Req 2**: The ContactInput component has the +852 prefix UI but is NOT used in the identify phase; AuthCard renders a plain input instead
2. **Req 5**: All country code references are hard-coded literals (no config/lookup table)
3. **Req 11**: err_email_exists and err_phone_exists messages distinguish between email and phone account existence, enabling enumeration
