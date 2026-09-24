# B: OTP Step Gaps Fixed

## 1. Target Masking
- Phone format: `+852 **** XXXX` (last 4 digits shown)
- Email format: `X***@domain` (first char + masked domain)
- Files modified:
  - `components/auth/AuthCard.tsx:34-45` (maskContact helper function)
  - `components/auth/AuthCard.tsx:818-824` (OTP subtitle with masking)
  - `components/auth/AuthCard.tsx:797-798` (signup OTP subtitle with masking)
- Evidence: Added `maskContact()` utility that detects contact type and applies appropriate masking. Phone numbers show `+852 **** 1234` format, emails show `a***@example.com` format. Updated all OTP subtitle displays to use masked values instead of full contact info.

## 2. Resend Countdown
- Changed from: 60 seconds
- Changed to: 30 seconds
- File: `components/auth/AuthCard.tsx:26`
- Evidence: Updated `RESEND_COOLDOWN` constant from `60` to `30`

## 3. Shake Animation
- Trigger: verification error (status="failure")
- Duration: 150ms (uses existing CSS keyframe)
- prefers-reduced-motion: preserved (existing CSS respects media query)
- File: `components/auth/OtpInput.tsx:109-111`
- Evidence: Added inline style with `animation: invalid ? 'otp-shake 150ms ease-in-out' : undefined` to trigger shake on error. Leverages existing `@keyframes otp-shake` defined in `app/globals.css:537`

## 4. Hourly Limit Warning
- Added keys: `otp_hourly_limit`
  - zh-HK: "已達每小時重發上限，請稍後再試"
  - zh-CN: "已达每小时重发上限，请稍后再试"
  - en: "Hourly resend limit reached. Please try again later."
- Trigger: rate limit API response (detects "hourly" keyword in error message)
- File: `components/auth/OtpVerification.tsx:71-72`
- Evidence: Added detection logic `isHourlyLimit` that checks for "hourly"/"每小時"/"每小时" in error string, displays translated `otp_hourly_limit` message when detected

## 5. More Options Sheet
- Added keys:
  - `otp_more_options` (zh-HK: "更多選項", zh-CN: "更多选项", en: "More options")
  - `otp_sent_to` (zh-HK: "已發送至", zh-CN: "已发送至", en: "Sent to")
- Actions available:
  - "Try a different method" (switches between email/phone if available)
  - "Go back" to contact entry
  - "Close" modal
- Files modified:
  - `components/auth/OtpVerification.tsx:25-28` (added props for callbacks and modal state)
  - `components/auth/OtpVerification.tsx:77-155` (modal UI implementation)
  - `components/auth/AuthCard.tsx:797,830` (passed callbacks to OtpVerification)
- Evidence: Implemented bottom sheet modal with glass morphism styling. Shows "More options" link below OTP input. Modal opens with 3 actions, uses click-outside-to-close pattern. Callbacks are optional props, only show modal when at least one callback is provided.

## Files Modified
- components/auth/AuthCard.tsx (+16 lines: maskContact function, RESEND_COOLDOWN change, masked subtitles, callback props)
- components/auth/OtpInput.tsx (+3 lines: shake animation trigger)
- components/auth/OtpVerification.tsx (+82 lines: hourly limit detection, modal state, modal UI, callback props)
- messages/zh-HK.json (+3 keys: otp_hourly_limit, otp_more_options, otp_sent_to)
- messages/zh-CN.json (+3 keys: otp_hourly_limit, otp_more_options, otp_sent_to)
- messages/en.json (+3 keys: otp_hourly_limit, otp_more_options, otp_sent_to)

## Implementation Notes
- All masked display uses formal written Chinese (書面語) as required
- Shake animation respects prefers-reduced-motion via existing CSS
- No changes to validation logic or API calls (UI/UX only)
- Modal uses existing component patterns (fixed overlay, bottom sheet, glass styling)
- Hourly limit detection is defensive (checks multiple language variants)
