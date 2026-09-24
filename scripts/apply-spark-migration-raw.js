#!/usr/bin/env node
/**
 * Apply Spark (Beta) database migration using raw SQL via Supabase Management API
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const PROJECT_REF = 'wqmciwieiqvnswvspdyz'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

function executeQuery(sql) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query: sql })

    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation'
      }
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: body })
        } else {
          resolve({ success: false, status: res.statusCode, error: body })
        }
      })
    })

    req.on('error', (e) => reject(e))
    req.write(postData)
    req.end()
  })
}

async function main() {
  console.log('📦 Reading migration file...')
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '0030_spark_beta_tables.sql')
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8')

  console.log('🚀 Applying Spark (Beta) migration via Supabase REST API...\n')

  // Split into individual executable statements
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== '')

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';'
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 70)

    process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `)

    try {
      const result = await executeQuery(stmt)

      if (result.success) {
        console.log('✓')
      } else {
        const errorText = result.error

        // Check if it's a benign "already exists" error
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          console.log('(already exists, OK)')
        } else if (errorText.includes('does not exist')) {
          console.log('(not found, OK)')
        } else if (errorText.includes('No API key found') || errorText.includes('exec')) {
          console.log('\n\n⚠️  Direct SQL execution not available via REST API')
          console.log('   This is expected — Supabase REST API doesn\'t expose raw SQL execution')
          console.log('\n📋 Please apply the migration manually:')
          console.log(`   1. Go to https://supabase.com/dashboard/project/${PROJECT_REF}/sql`)
          console.log('   2. Open the SQL Editor')
          console.log(`   3. Copy/paste: supabase/migrations/0030_spark_beta_tables.sql`)
          console.log('   4. Run the query\n')
          process.exit(0)
        } else {
          console.log(`✗\n   Error (${result.status}): ${errorText}`)
          throw new Error(errorText)
        }
      }
    } catch (err) {
      console.log(`✗\n   ${err.message}`)
      process.exit(1)
    }
  }

  console.log('\n✅ Migration complete!')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
