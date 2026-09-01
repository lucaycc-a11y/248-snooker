#!/usr/bin/env node
/**
 * Run the confirm_booking ambiguity fix migration via Supabase Management API.
 * Usage: node scripts/run-migration.mjs <supabase-token>
 *
 * Requires SUPABASE_ACCESS_TOKEN or a token passed as argument.
 * Reads the SQL from supabase/migrations/20260822_fix_confirm_booking_ambiguity.sql
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_REF = 'wqmciwieiqvnswvspdyz'

const token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN
if (!token) {
  console.error('Usage: node scripts/run-migration.mjs <supabase-access-token>')
  console.error('Or set SUPABASE_ACCESS_TOKEN environment variable')
  process.exit(1)
}

const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '20260822_fix_confirm_booking_ambiguity.sql')
const sql = readFileSync(sqlPath, 'utf-8')

console.log(`Running migration against project ${PROJECT_REF}...`)
console.log(`SQL size: ${sql.length} bytes`)

const response = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)

const result = await response.text()
console.log(`Status: ${response.status}`)
console.log(`Response: ${result}`)

if (response.ok) {
  console.log('\n✓ Migration executed successfully!')
} else {
  console.error('\n✗ Migration failed!')
  process.exit(1)
}