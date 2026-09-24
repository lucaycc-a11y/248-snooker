# A4 Profile Step & Database Verification Audit

## Requirement 1: Profile form collects name + date of birth (day/month/year, numeric inputs with auto-advance)

✅ **DONE**: Form collects name and date of birth with three numeric inputs (DD/MM/YYYY) that auto-advance
- **Evidence**: 
  - ProfileCompletion.tsx:102 — `const [dateOfBirth, setDateOfBirth] = useState({ day: "", month: "", year: "" })`
  - ProfileCompletion.tsx:516-522 — DateInput component rendered with value/onChange
  - DateInput.tsx:30-48 — Auto-advance logic: day→month (line 34), month→year (line 42)
  - DateInput.tsx:135-176 — Three numeric inputs with inputMode="numeric", pattern="[0-9]*", maxLength constraints

## Requirement 2: DOB validation (real calendar date including leap years, not in future, year >= 1900)

✅ **DONE**: Full validation implemented in both client and server
- **Evidence**:
  - date-validation.ts:19-61 — validateDateOfBirth function checks year >= 1900 (line 25), not future (lines 29-32, 53-55), valid date including leap years (lines 43-50)
  - date-validation.ts:66-68 — isLeapYear helper: `(year % 4 === 0 && year % 100 !== 0) || year % 400 === 0`
  - app/api/profile/complete/route.ts:73-100 — Server-side validation duplicates all checks
  - DateInput.tsx:70-114 — Client-side live validation as user types

## Requirement 3: Birthday purpose copy "用於核實年齡" (zh-HK)

❌ **MISSING**: Birthday hint text exists but does NOT contain "用於核實年齡"
- **Evidence**: 
  - messages/zh-HK.json:64 — `"profile_date_of_birth_hint": "YYYY-MM-DD"`
  - Current hint is format instruction only, not purpose statement
  - ProfileCompletion.tsx:521 — Renders `labels.date_of_birth_hint` from translation

## Requirement 4: Progress indicator shows 3 steps for new users, 2 steps for returning users

❓ **CANNOT VERIFY**: No progress indicator implementation found in ProfileCompletion component
- **Evidence**: 
  - ProfileCompletion.tsx:1-557 — Entire component contains no step counter, progress bar, or "Step X of Y" UI
  - Searched for: "step", "Step", "進度", "1/3", "2/3" — no matches in ProfileCompletion.tsx
  - Component has internal phases (form vs phoneOtp) but no visible progress indicator

## Requirement 5: Returning users see "歡迎回來，{name}" message

❌ **MISSING**: No welcome-back message implementation found
- **Evidence**:
  - Searched messages/zh-HK.json for "歡迎回來" — no results
  - ProfileCompletion.tsx has no conditional title/subtitle based on returning vs new user
  - ProfileCompletion.tsx:446-453 — Always shows same title/subtitle regardless of user state

## Requirement 6: Migration SQL file exists with correct schema

✅ **DONE**: Migration file exists with correct nullable DATE column
- **Evidence**: supabase/migrations/20260924000000_add_date_of_birth.sql:7-8
  ```sql
  ALTER TABLE users
  ADD COLUMN date_of_birth DATE;
  ```
  - No default value (line 8)
  - Check constraints added: not future (lines 12-13), >= 1900-01-01 (lines 16-17)
  - Both constraints allow NULL (lines 13, 17)

## Requirement 7: Existing users with NULL date_of_birth can still log in (no breaking change)

✅ **DONE**: NULL values permitted, no breaking constraint
- **Evidence**:
  - 20260924000000_add_date_of_birth.sql:13, 17 — Both CHECK constraints explicitly allow NULL: `date_of_birth IS NULL OR ...`
  - app/api/profile/complete/route.ts:230 — date_of_birth field included in upsert but no NOT NULL constraint
  - Migration adds column as nullable with no default, so existing rows get NULL automatically

## Requirement 8: Grep for MIN_AGE / minAge / 年齡限制 returns nothing (no age limit logic)

⚠️ **PARTIAL**: No age limit in profile/auth code, but facility age restriction exists in terms
- **Evidence**:
  - Grep output shows only facility usage age restrictions in legal terms: "年齡限制： 未滿十二（12）歲之人士，必須由至少一名年滿十八歲之成人全程陪同"
  - Found in: content/legal/terms.zh-HK.ts (facility rules, not profile validation)
  - NO matches in:
    - components/auth/*.tsx
    - lib/auth/*.ts
    - app/api/profile/complete/route.ts
  - Profile completion code collects DOB but performs ZERO age-based validation or rejection

---

## Summary

**PASSING**: 5/8 requirements
**FAILING**: 2/8 requirements  
**CANNOT VERIFY**: 1/8 requirement

### Critical Gaps:
1. ❌ **Requirement 3**: Birthday hint does not explain purpose ("用於核實年齡" missing)
2. ❌ **Requirement 5**: No welcome-back message for returning users
3. ❓ **Requirement 4**: Progress indicator not found (cannot confirm existence)

### Confirmed Working:
- Date input with auto-advance (Req 1)
- Full DOB validation including leap years (Req 2)
- Migration schema correct and non-breaking (Req 6, 7)
- No age limit enforcement in auth flow (Req 8)
