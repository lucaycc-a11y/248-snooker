#!/usr/bin/env tsx
/**
 * Test script for the Supabase Send SMS Hook
 *
 * This script simulates a Supabase Send SMS Hook request to verify:
 * 1. The signature verification works correctly
 * 2. The Engagelab integration sends SMS with custom OTP codes
 * 3. Invalid signatures are rejected
 *
 * Usage:
 *   npx tsx scripts/test-send-sms-hook.ts
 *
 * Prerequisites:
 * - SUPABASE_AUTH_HOOK_SECRET must be set in .env.local
 * - ENGAGELAB_AUTH_BASE64 must be set in .env.local
 * - The Next.js dev server must be running (npm run dev)
 */

import * as crypto from 'crypto'

// Load environment variables
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET
const TEST_ENDPOINT = 'http://localhost:3000/api/auth/hooks/send-sms'

if (!HOOK_SECRET) {
  console.error('❌ SUPABASE_AUTH_HOOK_SECRET not set in .env.local')
  console.log('\n📝 To set it up:')
  console.log('1. Generate a random secret: openssl rand -base64 32')
  console.log('2. Add to .env.local: SUPABASE_AUTH_HOOK_SECRET="<generated-secret>"')
  process.exit(1)
}

function generateSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  return hmac.digest('hex')
}

async function testValidRequest() {
  console.log('\n🧪 Test 1: Valid signed request')
  console.log('─'.repeat(60))

  const payload = {
    user: {
      id: 'test-user-123',
      phone: '+85266009975', // Test phone number
      user_metadata: { locale: 'zh_HK' },
    },
    sms: {
      otp: '123456', // Test OTP code
    },
  }

  const payloadString = JSON.stringify(payload)
  const signature = generateSignature(payloadString, HOOK_SECRET)

  console.log('📤 Sending request with valid signature...')
  console.log('Phone:', payload.user.phone)
  console.log('OTP:', payload.sms.otp)
  console.log('Signature:', signature.substring(0, 16) + '...')

  try {
    const res = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-signature': signature,
      },
      body: payloadString,
    })

    if (res.ok) {
      console.log('✅ Success! SMS sent via Engagelab')
      console.log('Status:', res.status)
      console.log('⚠️  Check your phone for the SMS with OTP: 123456')
    } else {
      const text = await res.text()
      console.log('❌ Failed with status:', res.status)
      console.log('Response:', text)
    }
  } catch (error) {
    console.error('❌ Request failed:', error)
  }
}

async function testInvalidSignature() {
  console.log('\n🧪 Test 2: Invalid signature (should be rejected)')
  console.log('─'.repeat(60))

  const payload = {
    user: {
      id: 'test-user-456',
      phone: '+85266009975',
      user_metadata: { locale: 'zh_HK' },
    },
    sms: {
      otp: '654321',
    },
  }

  const payloadString = JSON.stringify(payload)
  const fakeSignature = 'invalid_signature_1234567890abcdef'

  console.log('📤 Sending request with INVALID signature...')
  console.log('Signature:', fakeSignature)

  try {
    const res = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-signature': fakeSignature,
      },
      body: payloadString,
    })

    if (res.status === 401) {
      console.log('✅ Correctly rejected with 401 Unauthorized')
    } else {
      console.log('❌ Unexpected status:', res.status)
      console.log('⚠️  Security issue: Invalid signatures should return 401')
    }
  } catch (error) {
    console.error('❌ Request failed:', error)
  }
}

async function testMissingSignature() {
  console.log('\n🧪 Test 3: Missing signature (should be rejected)')
  console.log('─'.repeat(60))

  const payload = {
    user: {
      id: 'test-user-789',
      phone: '+85266009975',
      user_metadata: { locale: 'zh_HK' },
    },
    sms: {
      otp: '999999',
    },
  }

  console.log('📤 Sending request with NO signature header...')

  try {
    const res = await fetch(TEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No x-supabase-signature header
      },
      body: JSON.stringify(payload),
    })

    if (res.status === 401) {
      console.log('✅ Correctly rejected with 401 Unauthorized')
    } else {
      console.log('❌ Unexpected status:', res.status)
      console.log('⚠️  Security issue: Missing signatures should return 401')
    }
  } catch (error) {
    console.error('❌ Request failed:', error)
  }
}

async function main() {
  console.log('🔐 Supabase Send SMS Hook Test Suite')
  console.log('═'.repeat(60))
  console.log('Endpoint:', TEST_ENDPOINT)
  console.log('Secret configured:', HOOK_SECRET.substring(0, 8) + '...')

  await testValidRequest()
  await testInvalidSignature()
  await testMissingSignature()

  console.log('\n═'.repeat(60))
  console.log('✨ Test suite completed')
  console.log('\n📋 Next steps:')
  console.log('1. Verify SMS was received on test phone')
  console.log('2. Check console logs for send_sms_hook events')
  console.log('3. Configure the hook in Supabase Dashboard:')
  console.log('   - Authentication → Hooks → Send SMS hook')
  console.log('   - Type: HTTPS')
  console.log(`   - URL: https://yourdomain.com/api/auth/hooks/send-sms`)
  console.log(`   - Secret: ${HOOK_SECRET}`)
}

main().catch(console.error)
