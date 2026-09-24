#!/usr/bin/env node

// Test ProfileCompletion validation logic for different missingContact scenarios

// Copy of validation from lib/auth/profile.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeHkPhone(raw) {
  if (!raw) return null
  const digits = raw.replace(/[\s\-()]/g, '').replace(/^\+?852/, '')
  if (!/^[2-9]\d{7}$/.test(digits)) return null
  return `+852${digits}`
}

function validateProfile(input) {
  const name = (input.name ?? '').trim()
  if (name.length < 1 || name.length > 100) {
    return { ok: false, field: 'name', error: 'name_required' }
  }

  const email = (input.email ?? '').trim().toLowerCase()
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, field: 'email', error: 'email_invalid' }
  }

  const phone = normalizeHkPhone(input.phone ?? '')
  if (!phone) {
    return { ok: false, field: 'phone', error: 'phone_invalid' }
  }

  return { ok: true, value: { display_name: name, email, phone } }
}

// Simulate ProfileCompletion logic
function testProfileCompletionScenario(scenario) {
  console.log(`\n━━━ ${scenario.description} ━━━`)

  const { missingContact, verifiedEmail, verifiedPhone, showName, name, email, phone, initialEmail } = scenario

  // Line 126: const showEmail = missingContact !== "phone" && !verifiedEmail
  const showEmail = missingContact !== "phone" && !verifiedEmail
  console.log(`showEmail: ${showEmail}`)

  // Line 127: const showPhone = missingContact !== "email" && !verifiedPhone
  const showPhone = missingContact !== "email" && !verifiedPhone
  console.log(`showPhone: ${showPhone}`)

  // Line 129: const effectiveEmail = showEmail ? email : (verifiedEmail ?? initialEmail)
  const effectiveEmail = showEmail ? email : (verifiedEmail ?? initialEmail)
  console.log(`effectiveEmail: "${effectiveEmail}"`)

  // Line 130: const effectivePhone = showPhone ? phone : (verifiedPhone ?? initialPhone)
  const effectivePhone = showPhone ? phone : (verifiedPhone ?? phone)
  console.log(`effectivePhone: "${effectivePhone}"`)

  // Line 131-135: validation logic
  const validation = showName
    ? validateProfile({ name, email: effectiveEmail, phone: effectivePhone })
    : missingContact === "phone"
      ? validateProfile({ name: name || " ", email: "x@x.com", phone: effectivePhone })
      : validateProfile({ name: name || " ", email: effectiveEmail, phone: "12345678" })

  console.log(`Validation result: ${validation.ok ? '✅ PASS' : '❌ FAIL'}`)
  if (!validation.ok) {
    console.log(`  Failed field: ${validation.field}`)
    console.log(`  Error: ${validation.error}`)
  }
}

// Scenario 1: OAuth user (has email) needs to add phone
testProfileCompletionScenario({
  description: "OAuth user adds phone (missingContact='phone')",
  missingContact: "phone",
  verifiedEmail: "user@gmail.com",
  verifiedPhone: undefined,
  showName: false,
  name: "",
  email: "", // User can't even type in email field (it's hidden)
  phone: "12345678",
  initialEmail: "user@gmail.com"
})

// Scenario 2: SMS user (has phone) needs to add email
testProfileCompletionScenario({
  description: "SMS user adds email (missingContact='email')",
  missingContact: "email",
  verifiedEmail: undefined,
  verifiedPhone: "+85212345678",
  showName: false,
  name: "",
  email: "hello@gmail.com", // User types this
  phone: "",
  initialEmail: ""
})

// Scenario 3: New user needs everything
testProfileCompletionScenario({
  description: "New user completes full profile (missingContact=undefined)",
  missingContact: undefined,
  verifiedEmail: undefined,
  verifiedPhone: undefined,
  showName: true,
  name: "John Doe",
  email: "hello@gmail.com",
  phone: "12345678",
  initialEmail: ""
})
