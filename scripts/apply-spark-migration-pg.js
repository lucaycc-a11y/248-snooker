#!/usr/bin/env node
/**
 * Apply Spark (Beta) database migration using pg client directly
 * Requires: npm install pg
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

// Supabase direct connection (non-pooler) for DDL operations
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const connectionString = `postgresql://postgres:Lukelucaspace8@db.wqmciwieiqvnswvspdyz.supabase.co:5432/postgres`

async function main() {
  console.log('📦 Reading migration file...')
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0030_spark_beta_tables.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('🔌 Connecting to Supabase PostgreSQL...')
  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log('✓ Connected\n')

    console.log('🚀 Executing migration...')
    await client.query(migrationSql)
    console.log('✓ Migration executed\n')

    // Verify tables exist
    console.log('📋 Verifying tables...')
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('spark_conversations', 'spark_messages', 'spark_feedback')
      ORDER BY table_name
    `)

    console.log('✅ Tables found:')
    rows.forEach(r => console.log(`   - ${r.table_name}`))

    console.log('\n🎉 Spark (Beta) database migration complete!')
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    if (err.message.includes('already exists')) {
      console.log('   (Tables may already exist — this is OK)')
      process.exit(0)
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
