# ProfileCompletion Email Validation Flow Trace

## User types "hello@gmail.com" in email field

### State changes:
1. Line 95: `const [email, setEmail] = useState(initialEmail)`
2. Line 430: `onChange={(e) => setEmail(e.target.value)}`
   - User types → `email` state = "hello@gmail.com"

### Validation computation (runs on every render):
3. Line 126: `const showEmail = missingContact !== "phone" && !verifiedEmail`
4. Line 129: `const effectiveEmail = showEmail ? email : (verifiedEmail ?? initialEmail)`
   - If showEmail is TRUE: uses typed `email` ✅
   - If showEmail is FALSE: uses `verifiedEmail` or `initialEmail` ❌

5. Line 131-135: Validation call
   ```typescript
   const validation = showName
     ? validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
     : missingContact === "phone"
       ? validateProfile({ name: name || " ", email: "x@x.com", phone: effectivePhone })
       : validateProfile({ name: name || " ", email: effectiveEmail, phone: "12345678" })
   ```

## 🔍 THE BUG: Line 134 hardcodes `email: "x@x.com"` when `missingContact === "phone"`

### Scenario that triggers the bug:
- User signs in via OAuth (Apple/Google) → has email
- User needs to add phone → `missingContact = "phone"`
- Email field is HIDDEN (line 126: `showEmail = false`)
- But validation still runs on line 134 with `email: "x@x.com"`

Wait, that's not it. Let me check if `missingContact === "email"` case uses effectiveEmail...

### Line 135: When `missingContact === "email"`
```typescript
validateProfile({ name: name || " ", email: effectiveEmail, phone: "12345678" })
```

This uses `effectiveEmail`, which on line 129 becomes:
- `showEmail ? email : (verifiedEmail ?? initialEmail)`
- But `showEmail` is TRUE when `missingContact === "email"` (line 126)
- So it SHOULD use the typed email...

## Wait - let me check the ACTUAL error reporting

Line 138-141:
```typescript
const errorFor = (v: ProfileValidation): string => {
  if (v.ok) return ""
  return v.field === "name" ? labels.err_name : v.field === "email" ? labels.err_email : labels.err_phone
}
```

This maps validation errors to label keys, but where does the ACTUAL error display come from?

Line 478-482:
```typescript
{errMsg && (
  <p data-cms-key="auth.profile.error" style={{ marginTop: 12, fontSize: 13, color: "#f87171" }}>
    {errMsg}
  </p>
)}
```

This shows `errMsg` state, which is set in multiple places. Let me check where email validation sets errMsg...
