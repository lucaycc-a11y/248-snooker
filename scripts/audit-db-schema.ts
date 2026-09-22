#!/usr/bin/env tsx
/**
 * Direct database schema audit script
 * Queries live Supabase to verify what actually exists vs. what migrations assume
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wqmciwieiqvnswvspdyz.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function main() {
  console.log('🔍 Part 1 — Database Schema Audit\n')

  // 1. Check for phantom tables
  console.log('1️⃣  Checking for phantom tables (offers, user_offers, member_tiers, birthday_perk_usage)...')
  const { data: phantomCheck } = await supabase.rpc('query', {
    query: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('offers', 'user_offers', 'member_tiers', 'birthday_perk_usage')
      ORDER BY table_name
    `
  })
  console.log('   Result:', phantomCheck || 'NONE EXIST ✅')

  // 2. Check users table columns
  console.log('\n2️⃣  Checking users table structure...')
  const { data: usersColumns } = await supabase.rpc('query', {
    query: `
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
        AND column_name IN ('tier', 'tier_id', 'points', 'lifetime_points', 'member_code', 'member_qr_jwt')
      ORDER BY column_name
    `
  })
  console.log('   Columns:', usersColumns)

  // 3. Get actual tier values in use
  console.log('\n3️⃣  Checking actual tier values in users table...')
  const { data: tierValues } = await supabase
    .from('users')
    .select('tier')
    .not('tier', 'is', null)

  const uniqueTiers = [...new Set(tierValues?.map(u => u.tier))]
  console.log('   Tier values in use:', uniqueTiers)

  // 4. Check existing coupon/points tables
  console.log('\n4️⃣  Checking existing coupon/points infrastructure...')
  const { data: existingTables } = await supabase.rpc('query', {
    query: `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE '%coupon%'
             OR table_name LIKE '%points%'
             OR table_name LIKE '%contact%'
             OR table_name LIKE '%account%'
             OR table_name LIKE '%webhook%')
      ORDER BY table_name
    `
  })
  console.log('   Tables:', existingTables?.map((t: any) => t.table_name))

  // 5. Check points_ledger structure and type values
  console.log('\n5️⃣  Checking points_ledger...')
  const { data: ledgerCols } = await supabase.rpc('query', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'points_ledger'
      ORDER BY ordinal_position
    `
  })
  console.log('   Columns:', ledgerCols)

  const { data: ledgerTypes } = await supabase
    .from('points_ledger')
    .select('type')
  const uniqueTypes = [...new Set(ledgerTypes?.map(l => l.type))]
  console.log('   Type values in use:', uniqueTypes)

  // 6. Check contact_change_requests structure
  console.log('\n6️⃣  Checking contact_change_requests...')
  const { data: contactCols } = await supabase.rpc('query', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'contact_change_requests'
      ORDER BY ordinal_position
    `
  })
  console.log('   Columns:', contactCols?.map((c: any) => c.column_name))

  // 7. Check account_change_requests
  console.log('\n7️⃣  Checking account_change_requests...')
  const { data: accountCols } = await supabase.rpc('query', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'account_change_requests'
      ORDER BY ordinal_position
    `
  })
  console.log('   Columns:', accountCols?.map((c: any) => c.column_name))

  // 8. Check webhook_events
  console.log('\n8️⃣  Checking webhook_events...')
  const { data: webhookCols } = await supabase.rpc('query', {
    query: `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'webhook_events'
      ORDER BY ordinal_position
    `
  })
  console.log('   Columns:', webhookCols?.map((c: any) => c.column_name))

  console.log('\n✅ Schema audit complete')
}

main().catch(console.error)
