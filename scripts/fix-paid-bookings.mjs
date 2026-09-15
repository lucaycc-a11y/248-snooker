#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Bookings that have succeeded PaymentIntents in Stripe but failed in our DB
const updates = [
  {
    id: 'c7176c80-15db-491e-b79a-0957281669ea',
    paymentIntentId: 'pi_3UFXH35S9CcpaekN0OwU8rr2',
    amount: 5
  },
  {
    id: 'a2bc45e1-0f2f-400f-a56d-8dd68976e9dc',
    paymentIntentId: 'pi_3UFqJl5S9CcpaekN12t9N2Nb',
    amount: 5
  }
]

console.log('🚨 MANUAL CORRECTION: Updating bookings with successful Stripe payments\n')

for (const booking of updates) {
  console.log(`Processing booking ${booking.id}...`)

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_provider: 'stripe',
      provider_order_no: booking.paymentIntentId,
      stripe_payment_intent: booking.paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', booking.id)
    .select()

  if (error) {
    console.error(`  ❌ Failed to update booking ${booking.id}:`, error)
  } else if (data && data.length > 0) {
    console.log(`  ✅ Successfully updated booking ${booking.id}`)
    console.log(`     Status: confirmed, Payment: paid, Provider: stripe`)
  } else {
    console.log(`  ⚠️  No rows updated for booking ${booking.id} (might not exist)`)
  }
  console.log('')
}

console.log('✅ Manual correction completed')
