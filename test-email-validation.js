#!/usr/bin/env node

// Direct test of the email validation logic from lib/auth/profile.ts
// to find why hello@gmail.com is rejected

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function testEmail(raw) {
  console.log(`\n━━━ Testing: "${raw}" ━━━`)

  const email = (raw ?? '').trim().toLowerCase()
  console.log(`After trim/lowercase: "${email}"`)
  console.log(`Length: ${email.length}`)

  // Length check (line 46)
  const lengthCheck = email.length > 254
  console.log(`Length > 254? ${lengthCheck}`)

  // Regex check (line 46)
  const regexCheck = EMAIL_RE.test(email)
  console.log(`Regex match? ${regexCheck}`)

  // Combined validation (line 46-48)
  const isValid = !(email.length > 254 || !EMAIL_RE.test(email))
  console.log(`Overall valid? ${isValid}`)

  if (!isValid) {
    console.log(`❌ REJECTED`)
  } else {
    console.log(`✅ ACCEPTED`)
  }
}

// Test cases
testEmail('hello@gmail.com')
testEmail('test@example.com')
testEmail('a@b.c')
testEmail('')
testEmail('no-at-sign')
testEmail('missing-domain@')
testEmail('@missing-local.com')
