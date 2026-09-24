/**
 * One-time script to apply Spark (Beta) database migration
 * Run with: node scripts/apply-spark-migration.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

async function applyMigration() {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  console.log('📦 Creating Supabase admin client...')
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Read migration SQL
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0030_spark_beta_tables.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('🚀 Applying Spark (Beta) migration...')
  console.log('   Creating tables: spark_conversations, spark_messages, spark_feedback')

  // Split into individual statements and execute
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'

    // Skip comments
    if (statement.trim().startsWith('--')) continue

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement })

      if (error) {
        // Check if it's a "already exists" error (safe to ignore)
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log(`   ⚠️  Skipped (already exists): statement ${i + 1}`)
          continue
        }
        throw error
      }

      console.log(`   ✓ Statement ${i + 1}/${statements.length}`)
    } catch (err) {
      console.error(`   ❌ Failed at statement ${i + 1}:`, err.message)
      console.error('   Statement:', statement.slice(0, 100) + '...')
      process.exit(1)
    }
  }

  console.log('✅ Spark (Beta) migration applied successfully')
  console.log('')
  console.log('Verifying tables...')

  // Verify tables exist
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .in('table_name', ['spark_conversations', 'spark_messages', 'spark_feedback'])
    .eq('table_schema', 'public')

  if (tablesError) {
    console.error('❌ Verification failed:', tablesError.message)
  } else {
    console.log('✅ Verified tables:', tables.map(t => t.table_name).join(', '))
  }
}

applyMigration().catch(console.error)
