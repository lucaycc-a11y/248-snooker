#!/usr/bin/env node
/**
 * Apply Spark (Beta) database migration directly using service role key
 * Executes each SQL statement individually via Supabase client
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function executeSql(sql) {
  const { data, error } = await supabase.rpc('execute_sql', { sql })
  return { data, error }
}

async function main() {
  console.log('📦 Reading migration file...')
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0030_spark_beta_tables.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('🚀 Applying Spark (Beta) migration...\n')

  // Execute as a single transaction
  try {
    const { error } = await supabase.rpc('exec', { sql: migrationSql })

    if (error) {
      // If bulk execution fails, try statement by statement
      console.log('⚠️  Bulk execution failed, trying individual statements...\n')

      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i]
        console.log(`[${i + 1}/${statements.length}] ${stmt.slice(0, 60)}...`)

        const { error: stmtError } = await supabase.rpc('exec', { sql: stmt + ';' })

        if (stmtError) {
          if (stmtError.message.includes('already exists')) {
            console.log('   ↳ Already exists (OK)')
          } else if (stmtError.message.includes('does not exist')) {
            console.log('   ↳ Not found (OK)')
          } else {
            console.error('   ↳ ❌ Error:', stmtError.message)
            throw stmtError
          }
        } else {
          console.log('   ↳ ✓')
        }
      }
    } else {
      console.log('✅ Migration executed successfully')
    }

    // Verify tables exist
    console.log('\n📋 Verifying tables...')
    const { data: conversations } = await supabase.from('spark_conversations').select('id').limit(0)
    const { data: messages } = await supabase.from('spark_messages').select('id').limit(0)
    const { data: feedback } = await supabase.from('spark_feedback').select('id').limit(0)

    if (conversations !== null && messages !== null && feedback !== null) {
      console.log('✅ All tables verified:')
      console.log('   - spark_conversations')
      console.log('   - spark_messages')
      console.log('   - spark_feedback')
    } else {
      throw new Error('Table verification failed')
    }

    console.log('\n🎉 Spark (Beta) database migration complete!')
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    process.exit(1)
  }
}

main()
