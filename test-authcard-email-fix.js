#!/usr/bin/env node

// Test that the AuthCard fix correctly normalizes empty strings to undefined

function testEmailNormalization(scenario) {
  console.log(`\n━━━ ${scenario.description} ━━━`)

  const { idEmail, dataEmail, userEmail } = scenario

  // Original buggy logic (line 148/210 before fix)
  const buggyValue = idEmail ?? dataEmail ?? userEmail ?? undefined
  console.log(`Buggy verifiedEmail: ${JSON.stringify(buggyValue)}`)

  // Fixed logic (line 148/210 after fix)
  const emailValue = idEmail ?? dataEmail ?? userEmail ?? undefined
  const fixedValue = emailValue || undefined
  console.log(`Fixed verifiedEmail: ${JSON.stringify(fixedValue)}`)

  // Test showEmail logic in ProfileCompletion
  const missingContact = "email" // SMS user needs email
  const buggyShowEmail = missingContact !== "phone" && !buggyValue
  const fixedShowEmail = missingContact !== "phone" && !fixedValue

  console.log(`Buggy showEmail: ${buggyShowEmail} ${buggyShowEmail ? '✅' : '❌ BUG'}`)
  console.log(`Fixed showEmail: ${fixedShowEmail} ${fixedShowEmail ? '✅ CORRECT' : '❌'}`)
}

// Test case 1: SMS user with empty string email (the bug scenario)
testEmailNormalization({
  description: "SMS user with empty string email (reproduces bug)",
  idEmail: undefined,
  dataEmail: null,
  userEmail: "" // Supabase returns empty string
})

// Test case 2: SMS user with null email
testEmailNormalization({
  description: "SMS user with null email",
  idEmail: undefined,
  dataEmail: null,
  userEmail: null
})

// Test case 3: SMS user with undefined email
testEmailNormalization({
  description: "SMS user with undefined email",
  idEmail: undefined,
  dataEmail: null,
  userEmail: undefined
})

// Test case 4: OAuth user with verified email
testEmailNormalization({
  description: "OAuth user with verified email",
  idEmail: "user@gmail.com",
  dataEmail: null,
  userEmail: ""
})
