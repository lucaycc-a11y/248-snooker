# B: Profile Step Gaps Fixed

## 1. Birthday Hint
- File: messages/zh-HK.json:64
- Changed from: "YYYY-MM-DD"
- Changed to: "用於核實年齡"
- Also updated: zh-CN ("用于核实年龄"), en ("For age verification")

## 2. Returning User Welcome
- Added keys: profile_welcome_back
  - zh-HK: "歡迎回來，{name}"
  - zh-CN: "欢迎回来，{name}"
  - en: "Welcome back, {name}"
- Logic: Detects returning users by checking if `initialName` prop is present
- Implementation: ProfileCompletion.tsx:137-138
  - Added `isReturningUser` boolean based on `Boolean(initialName)`
  - Title dynamically switches between `t("profile_welcome_back", { name: initialName })` and `labels.title`
- Evidence: ProfileCompletion.tsx:147 (main form), ProfileCompletion.tsx:398 (OTP sub-step)

## 3. Progress Indicator
- Component: Small text indicator showing "步驟 X / Y" (or "Step X of Y" in English)
- Position: Top-right of ProfileCompletion modal, above the title
- Logic:
  - New users: 3 steps total (phone verify → name+DOB → complete)
  - Returning users: 2 steps total (phone verify → DOB update)
  - Current step calculated based on `verifyMode` state
- Implementation: ProfileCompletion.tsx:139-140 (step calculation), ProfileCompletion.tsx:144-148 (UI render), ProfileCompletion.tsx:392-396 (OTP view)
- Added i18n key: `profile_step` ("步驟" / "步骤" / "Step")

## Files Modified
- components/auth/ProfileCompletion.tsx (+15 lines)
  - Added returning user detection logic
  - Added progress calculation (totalSteps, currentStep)
  - Added progress indicator UI component in both form views
  - Updated title to show welcome message for returning users
- messages/zh-HK.json (+2 keys)
  - Updated profile_date_of_birth_hint
  - Added profile_welcome_back
  - Added profile_step
- messages/zh-CN.json (+2 keys)
  - Updated profile_date_of_birth_hint
  - Added profile_welcome_back
  - Added profile_step
- messages/en.json (+2 keys)
  - Updated profile_date_of_birth_hint
  - Added profile_welcome_back
  - Added profile_step
