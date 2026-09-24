#!/usr/bin/env node
/**
 * Spark (Beta) — 11-Point Verification Test Suite (API-based)
 * Tests the backend implementation with real requests and evidence capture
 */

const http = require('http')
const fs = require('fs')

// Load environment
require('dotenv').config({ path: '.env.local' })

const results = []

function logResult(testNum, name, status, evidence) {
  const result = {
    test: testNum,
    name,
    status,
    evidence,
    timestamp: new Date().toISOString()
  }
  results.push(result)
  console.log(`\n[Test ${testNum}] ${name}: ${status}`)
  console.log(`  ${evidence}`)
  return result
}

async function makeRequest(path, method = 'GET', body = null, cookies = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      }
    }

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body))
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          })
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          })
        }
      })
    })

    req.on('error', reject)

    if (body) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

async function runTests() {
  console.log('=' .repeat(80))
  console.log('SPARK (BETA) — 11-POINT VERIFICATION TEST SUITE')
  console.log('=' .repeat(80))

  console.log('\n⚠️  Note: Full end-to-end testing requires authenticated admin session')
  console.log('    This suite verifies implementation integrity\n')

  // TEST 1: Verify API endpoint exists and requires auth
  console.log('\n' + '='.repeat(80))
  console.log('TEST 1: API Endpoint Security (Admin-Only)')
  console.log('='.repeat(80))

  try {
    const response = await makeRequest('/api/spark/chat', 'POST', {
      message: 'test',
      locale: 'zh-HK'
    })

    if (response.status === 401) {
      logResult(1, 'API Endpoint Security', 'PASS',
        `Endpoint correctly returns 401 Unauthorized without admin auth`)
    } else {
      logResult(1, 'API Endpoint Security', 'FAIL',
        `Endpoint returned ${response.status} instead of 401`)
    }
  } catch (e) {
    logResult(1, 'API Endpoint Security', 'FAIL',
      `API request failed: ${e.message}`)
  }

  // TEST 2-4: Guardrail keyword detection (unit test style)
  console.log('\n' + '='.repeat(80))
  console.log('TEST 2-4: Guardrail Keyword Detection')
  console.log('='.repeat(80))

  const { checkEscalationKeywords } = require('./lib/spark/guardrails')

  // Test 2: Cancellation keywords
  const cancelTests = ['取消預訂', 'cancel booking', '取消订单']
  let cancelPass = 0
  for (const msg of cancelTests) {
    const result = checkEscalationKeywords(msg)
    if (result.matched) cancelPass++
  }

  logResult(2, 'Cancel Keyword Guardrail', cancelPass === cancelTests.length ? 'PASS' : 'FAIL',
    `${cancelPass}/${cancelTests.length} cancellation keywords detected correctly`)

  // Test 3: Refund keywords
  const refundTests = ['退款', 'refund', 'money back', '退钱']
  let refundPass = 0
  for (const msg of refundTests) {
    const result = checkEscalationKeywords(msg)
    if (result.matched) refundPass++
  }

  logResult(3, 'Refund Keyword Guardrail', refundPass === refundTests.length ? 'PASS' : 'FAIL',
    `${refundPass}/${refundTests.length} refund keywords detected correctly`)

  // Test 4: Reschedule keywords
  const rescheduleTests = ['改期', 'reschedule', '更改日期', '更改预订']
  let reschedulePass = 0
  for (const msg of rescheduleTests) {
    const result = checkEscalationKeywords(msg)
    if (result.matched) reschedulePass++
  }

  logResult(4, 'Reschedule Keyword Guardrail', reschedulePass === rescheduleTests.length ? 'PASS' : 'FAIL',
    `${reschedulePass}/${rescheduleTests.length} reschedule keywords detected correctly`)

  // TEST 5: Normal questions should NOT trigger guardrail
  console.log('\n' + '='.repeat(80))
  console.log('TEST 5: Normal Questions (No Guardrail)')
  console.log('='.repeat(80))

  const normalQuestions = [
    '營業時間是什麼？',
    'What are your opening hours?',
    '如何預訂？',
    'How do I make a booking?'
  ]

  let normalPass = 0
  for (const msg of normalQuestions) {
    const result = checkEscalationKeywords(msg)
    if (!result.matched) normalPass++
  }

  logResult(5, 'Normal Questions (No Guardrail)', normalPass === normalQuestions.length ? 'PASS' : 'FAIL',
    `${normalPass}/${normalQuestions.length} normal questions correctly passed through`)

  // TEST 6: Model routing logic
  console.log('\n' + '='.repeat(80))
  console.log('TEST 6: Model Routing (Haiku vs Sonnet)')
  console.log('='.repeat(80))

  const { modelFor } = require('./lib/ai/vectorengine')

  const haikuModel = modelFor('simple')
  const sonnetModel = modelFor('complex')

  if (haikuModel === 'claude-haiku-4-5' && sonnetModel === 'claude-sonnet-5') {
    logResult(6, 'Model Routing', 'PASS',
      `Haiku: ${haikuModel}, Sonnet: ${sonnetModel}`)
  } else {
    logResult(6, 'Model Routing', 'FAIL',
      `Incorrect models - Haiku: ${haikuModel}, Sonnet: ${sonnetModel}`)
  }

  // TEST 7: System prompt builder
  console.log('\n' + '='.repeat(80))
  console.log('TEST 7: System Prompt Assembly')
  console.log('='.repeat(80))

  try {
    const { buildSparkSystemPrompt } = require('./lib/spark/build-system-prompt')

    const isFunction = typeof buildSparkSystemPrompt === 'function'

    if (isFunction) {
      logResult(7, 'System Prompt Builder', 'PASS',
        'buildSparkSystemPrompt function exists and is callable')
    } else {
      logResult(7, 'System Prompt Builder', 'FAIL',
        'buildSparkSystemPrompt is not a function')
    }
  } catch (e) {
    logResult(7, 'System Prompt Builder', 'FAIL',
      `Failed to load system prompt builder: ${e.message}`)
  }

  // TEST 8: UI Components
  console.log('\n' + '='.repeat(80))
  console.log('TEST 8: UI Components')
  console.log('='.repeat(80))

  const componentFiles = [
    'components/spark/SparkWidget.tsx',
    'components/spark/MessageBubble.tsx',
    'components/spark/TypingIndicator.tsx'
  ]

  let componentsExist = 0
  for (const file of componentFiles) {
    if (fs.existsSync(file)) {
      componentsExist++
    }
  }

  logResult(8, 'UI Components', componentsExist === componentFiles.length ? 'PASS' : 'FAIL',
    `${componentsExist}/${componentFiles.length} UI components exist`)

  // TEST 9: AdminShell integration
  console.log('\n' + '='.repeat(80))
  console.log('TEST 9: Admin Shell Integration')
  console.log('='.repeat(80))

  try {
    const adminShellContent = fs.readFileSync('components/admin/AdminShell.tsx', 'utf-8')
    const hasSparkWidget = adminShellContent.includes('SparkWidget')
    const hasImport = adminShellContent.includes("from '@/components/spark/SparkWidget'")

    if (hasSparkWidget && hasImport) {
      logResult(9, 'Admin Shell Integration', 'PASS',
        'SparkWidget imported and mounted in AdminShell')
    } else {
      logResult(9, 'Admin Shell Integration', 'FAIL',
        `Widget mounted: ${hasSparkWidget}, Import present: ${hasImport}`)
    }
  } catch (e) {
    logResult(9, 'Admin Shell Integration', 'FAIL',
      `Failed to read AdminShell.tsx: ${e.message}`)
  }

  // TEST 10: Database schema verification
  console.log('\n' + '='.repeat(80))
  console.log('TEST 10: Database Schema')
  console.log('='.repeat(80))

  try {
    const migrationContent = fs.readFileSync('supabase/migrations/0030_spark_beta_tables.sql', 'utf-8')
    const hasTables = migrationContent.includes('spark_conversations') &&
                      migrationContent.includes('spark_messages') &&
                      migrationContent.includes('spark_feedback')
    const hasRLS = migrationContent.includes('ROW LEVEL SECURITY')
    const hasPolicies = migrationContent.includes('CREATE POLICY')

    if (hasTables && hasRLS && hasPolicies) {
      logResult(10, 'Database Schema', 'PASS',
        'Migration includes all tables, RLS, and policies')
    } else {
      logResult(10, 'Database Schema', 'FAIL',
        `Tables: ${hasTables}, RLS: ${hasRLS}, Policies: ${hasPolicies}`)
    }
  } catch (e) {
    logResult(10, 'Database Schema', 'FAIL',
      `Failed to read migration file: ${e.message}`)
  }

  // TEST 11: TypeScript compilation check
  console.log('\n' + '='.repeat(80))
  console.log('TEST 11: TypeScript Compilation')
  console.log('='.repeat(80))

  try {
    const { spawnSync } = require('child_process')
    const result = spawnSync('npx', ['tsc', '--noEmit'], {
      cwd: process.cwd(),
      timeout: 60000,
      encoding: 'utf-8'
    })

    if (result.status === 0) {
      logResult(11, 'TypeScript Compilation', 'PASS',
        'All TypeScript files compile without errors')
    } else {
      logResult(11, 'TypeScript Compilation', 'FAIL',
        `TypeScript compilation failed with ${result.stderr.split('\n').length} errors`)
    }
  } catch (e) {
    logResult(11, 'TypeScript Compilation', 'FAIL',
      `Compilation check failed: ${e.message}`)
  }

  // Generate final report
  console.log('\n' + '='.repeat(80))
  console.log('TEST SUITE COMPLETE - RESULTS SUMMARY')
  console.log('='.repeat(80))

  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length

  console.log(`\n✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`📊 Total: ${results.length}`)

  // Save report
  const report = {
    summary: { passed, failed, total: results.length },
    timestamp: new Date().toISOString(),
    results
  }

  fs.writeFileSync('/tmp/spark-beta-verification-report.json', JSON.stringify(report, null, 2))
  console.log('\n📄 Detailed report: /tmp/spark-beta-verification-report.json')

  // Print failed tests
  const failedTests = results.filter(r => r.status === 'FAIL')
  if (failedTests.length > 0) {
    console.log('\n❌ Failed Tests:')
    failedTests.forEach(t => {
      console.log(`   [${t.test}] ${t.name}: ${t.evidence}`)
    })
  }

  console.log('\n' + '='.repeat(80))

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
  console.error('\n❌ Test suite error:', err)
  process.exit(1)
})
