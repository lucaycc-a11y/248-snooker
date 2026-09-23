#!/usr/bin/env node
/**
 * Test script to reproduce /member redirect issue
 * Checks user_password_status for real accounts and simulates middleware logic
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testMemberRedirect() {
  console.log('=== Testing /member Redirect Issue ===\n')

  // 1. Get recent users with their password status
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (usersError) {
    console.error('Error fetching users:', usersError.message)
    return
  }

  console.log(`Found ${users.length} recent users\n`)

  for (const user of users) {
    console.log(`\n─────────────────────────────────────`)
    console.log(`User: ${user.email}`)
    console.log(`ID: ${user.id}`)

    // Check password status
    const { data: status, error: statusError } = await supabase
      .from('user_password_status')
      .select('password_set, password_set_at, created_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (statusError) {
      console.error(`  ❌ Error checking password status: ${statusError.message}`)
      continue
    }

    if (!status) {
      console.log('  ⚠️  NO record in user_password_status table')
      console.log('  → Middleware will treat as password_set = null/undefined')
      console.log('  → Condition: if (!status?.password_set) → REDIRECT')
      console.log('  ✅ DIAGNOSIS: Missing row causes false positive redirect')
      continue
    }

    console.log(`  password_set: ${status.password_set}`)
    console.log(`  password_set_at: ${status.password_set_at || 'null'}`)
    console.log(`  status row created: ${status.created_at}`)

    // Check auth.users metadata FIRST
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id)

    // Simulate NEW middleware check (from middleware.ts:202-220)
    if (!status?.password_set) {
      // Check for OAuth identities
      const identities = authUser?.user?.identities || []
      const hasOAuth = identities.some(i => i.provider === 'google' || i.provider === 'apple')

      if (!hasOAuth) {
        console.log('  🚨 WOULD REDIRECT to /auth/set-password')
        console.log('  → Non-OAuth account without password')
      } else {
        console.log('  ✅ WOULD ALLOW access to /member')
        console.log('  → OAuth user, password not required')
      }
    } else {
      console.log('  ✅ WOULD ALLOW access to /member')
      console.log('  → Password is set')
    }
    if (authUser?.user) {
      const identities = authUser.user.identities || []
      console.log(`  Auth identities: ${identities.map(i => i.provider).join(', ') || 'none'}`)

      const hasPassword = identities.some(i => i.provider === 'email')
      console.log(`  Has 'email' provider (password-capable): ${hasPassword}`)
    }
  }

  console.log('\n\n=== Summary ===')
  console.log('The redirect happens in middleware.ts:202-207:')
  console.log('  if (!status?.password_set) { redirect("/auth/set-password") }')
  console.log('')
  console.log('Two scenarios trigger this:')
  console.log('  1. password_set = false (legitimately no password set)')
  console.log('  2. No row in user_password_status (missing trigger/migration)')
  console.log('')
  console.log('Check above results for which scenario applies.')
}

testMemberRedirect().catch(console.error)
