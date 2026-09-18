#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────
// One-off reconciliation script for bookings stuck in "pending" state
// despite Stripe showing payment as succeeded.
//
// Usage: tsx scripts/reconcile-stuck-bookings.ts [booking-id]
//
// If booking-id is provided, reconciles that specific booking.
// Otherwise, finds all bookings in pending state with a Stripe
// provider_order_no and checks their real status.
// ─────────────────────────────────────────────────────────────────

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') })

import { getServiceSupabase } from '../lib/supabase/service'
import { getStripe } from '../lib/stripe/server'
import { humanReadableCode } from '../lib/qr/jwt'

async function reconcileBooking(bookingId: string) {
  const supabase = getServiceSupabase()
  const stripe = getStripe()

  // Fetch booking details
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, status, payment_provider, provider_order_no, payment_method, order_group_id, human_code, total_price, user_id')
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) {
    console.error(`❌ Booking ${bookingId} not found:`, bookingErr?.message)
    return { success: false, reason: 'booking_not_found' }
  }

  console.log(`\n📋 Booking ${bookingId}:`)
  console.log(`   Status: ${booking.status}`)
  console.log(`   Provider: ${booking.payment_provider}`)
  console.log(`   Provider Order No: ${booking.provider_order_no}`)
  console.log(`   Total Price: HK$${booking.total_price}`)

  // Skip if not Stripe or no provider order
  if (booking.payment_provider !== 'stripe' || !booking.provider_order_no) {
    console.log('   ⏭️  Skipping: not a Stripe booking or no provider_order_no')
    return { success: false, reason: 'not_applicable' }
  }

  // Skip if already confirmed
  if (booking.status === 'confirmed') {
    console.log('   ✅ Already confirmed')
    return { success: true, reason: 'already_confirmed' }
  }

  // Query Stripe for the real status
  console.log(`\n🔍 Checking Stripe PaymentIntent ${booking.provider_order_no}...`)
  let intent
  try {
    intent = await stripe.paymentIntents.retrieve(booking.provider_order_no)
  } catch (stripeErr) {
    console.error('   ❌ Stripe API error:', (stripeErr as Error).message)
    return { success: false, reason: 'stripe_api_error' }
  }

  console.log(`   Stripe Status: ${intent.status}`)
  console.log(`   Amount: ${intent.amount} cents (HK$${intent.amount / 100})`)

  if (intent.status !== 'succeeded') {
    console.log(`   ⏭️  Not succeeded on Stripe — no reconciliation needed`)
    return { success: false, reason: 'not_succeeded' }
  }

  // Amount check
  const expectedCents = Math.round(Number(booking.total_price) * 100)
  if (expectedCents !== intent.amount) {
    console.error(`   ❌ AMOUNT MISMATCH:`)
    console.error(`      Expected: ${expectedCents} cents (HK$${expectedCents / 100})`)
    console.error(`      Charged:  ${intent.amount} cents (HK$${intent.amount / 100})`)
    console.error(`      Discrepancy: ${intent.amount - expectedCents} cents`)

    // Update to payment_review for manual handling
    await supabase
      .from('bookings')
      .update({ status: 'payment_review' })
      .eq('id', bookingId)

    console.log(`   🔶 Updated to payment_review — manual reconciliation required`)
    return { success: false, reason: 'amount_mismatch' }
  }

  console.log(`   ✅ Amount matches — proceeding with confirmation`)

  // Confirm the booking using the same RPC as the webhook
  try {
    if (booking.order_group_id) {
      const { data: rows, error: rowsErr } = await supabase
        .from('bookings')
        .select('id, total_price')
        .eq('order_group_id', booking.order_group_id)

      if (rowsErr || !rows || rows.length === 0) {
        throw new Error('Failed to fetch group bookings')
      }

      const qrCodes: Record<string, string> = {}
      for (const r of rows) {
        qrCodes[r.id] = humanReadableCode(r.id)
      }

      console.log(`\n📦 Confirming booking group (${rows.length} bookings)...`)
      await supabase.rpc('confirm_booking_group', {
        p_order_group_id: booking.order_group_id,
        p_payment_intent_id: booking.provider_order_no,
        p_payment_method: booking.payment_method || 'card',
        p_qr_codes: qrCodes,
        p_event_id: null,
      })
    } else {
      const humanCode = booking.human_code ?? humanReadableCode(booking.id)
      console.log(`\n✅ Confirming booking...`)
      await supabase.rpc('confirm_booking', {
        p_booking_id: booking.id,
        p_payment_intent_id: booking.provider_order_no,
        p_payment_method: booking.payment_method || 'card',
        p_qr_code: humanCode,
        p_event_id: null,
      })
    }

    // Send confirmation email
    try {
      const { sendBookingConfirmation } = await import('../lib/resend/template-send')
      await sendBookingConfirmation(booking.id)
      await supabase.from('notification_log').insert([
        { user_id: booking.user_id, booking_id: booking.id, channel: 'email', type: 'booking_confirmed', status: 'sent' },
        { user_id: booking.user_id, booking_id: booking.id, channel: 'whatsapp', type: 'booking_confirmed', status: 'pending' },
      ])
      console.log(`   📧 Confirmation email sent`)
    } catch (emailErr) {
      console.error(`   ⚠️  Email failed:`, (emailErr as Error).message)
    }

    // Mark payment attempt complete
    try {
      await supabase.rpc('complete_payment_attempt', {
        p_provider_order_no: booking.provider_order_no,
        p_provider: 'stripe',
      })
    } catch {
      // Non-fatal
    }

    console.log(`\n✅ Booking ${bookingId} successfully reconciled and confirmed`)
    return { success: true, reason: 'reconciled' }
  } catch (confirmErr) {
    console.error(`   ❌ Confirmation failed:`, (confirmErr as Error).message)
    return { success: false, reason: 'confirmation_failed' }
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length > 0) {
    // Reconcile specific booking
    const bookingId = args[0]
    console.log(`🔧 Reconciling booking ${bookingId}...`)
    await reconcileBooking(bookingId)
  } else {
    // Find and reconcile all stuck bookings
    console.log(`🔍 Finding stuck Stripe bookings...`)
    const supabase = getServiceSupabase()

    const { data: stuckBookings, error } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'pending')
      .eq('payment_provider', 'stripe')
      .not('provider_order_no', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('❌ Query failed:', error.message)
      process.exit(1)
    }

    if (!stuckBookings || stuckBookings.length === 0) {
      console.log('✅ No stuck bookings found')
      return
    }

    console.log(`\n📋 Found ${stuckBookings.length} pending Stripe bookings to check\n`)

    const results = {
      reconciled: 0,
      already_confirmed: 0,
      not_succeeded: 0,
      amount_mismatch: 0,
      failed: 0,
    }

    for (const booking of stuckBookings) {
      const result = await reconcileBooking(booking.id)
      if (result.success && result.reason === 'reconciled') {
        results.reconciled++
      } else if (result.reason === 'already_confirmed') {
        results.already_confirmed++
      } else if (result.reason === 'not_succeeded') {
        results.not_succeeded++
      } else if (result.reason === 'amount_mismatch') {
        results.amount_mismatch++
      } else {
        results.failed++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Reconciled: ${results.reconciled}`)
    console.log(`   ✓  Already confirmed: ${results.already_confirmed}`)
    console.log(`   ⏭️  Not succeeded on Stripe: ${results.not_succeeded}`)
    console.log(`   🔶 Amount mismatch (moved to review): ${results.amount_mismatch}`)
    console.log(`   ❌ Failed: ${results.failed}`)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
