import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { periodForStart, loadPeriods } from '@/lib/booking/server'
import { humanReadableCode } from '@/lib/qr/jwt'

type Block = {
  date: string
  startHour: number
  duration: number
  tableNumber: 1 | 2
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { blocks, method } = body as {
      blocks: Block[]
      method: string
    }

    if (!blocks || blocks.length === 0) {
      return NextResponse.json({ error: 'No blocks provided' }, { status: 400 })
    }

    // Get pricing from config table
    const { data: config } = await supabase
      .from('config')
      .select('hourly_rate')
      .single()

    const hourlyRate = config?.hourly_rate || 100

    // Load pricing periods for period calculation
    const periods = await loadPeriods()

    // Calculate total amount
    const totalHours = blocks.reduce((sum, b) => sum + b.duration, 0)
    const amount = Math.round(totalHours * hourlyRate * 100) // in cents

    // Generate order group ID for multi-block bookings
    const orderGroupId = blocks.length > 1 ? randomUUID() : null

    // Determine if this is a test booking
    const host = req.headers.get('host') || ''
    const isTest = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('.vercel.app')

    // Create bookings in database (status: pending)
    const bookingInserts = blocks.map((block) => {
      const bookingId = randomUUID()
      const dateObj = new Date(block.date + 'T00:00:00+08:00')
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
      const period = periodForStart(block.startHour, isWeekend, periods)
      const price = block.duration * hourlyRate

      return {
        id: bookingId,
        user_id: session.user.id,
        date: block.date,
        start_time: `${block.startHour.toString().padStart(2, '0')}:00`,
        end_time: `${(block.startHour + block.duration).toString().padStart(2, '0')}:00`,
        duration_hours: block.duration,
        period,
        table_number: block.tableNumber,
        total_price: price,
        base_price: price,
        subtotal: price,
        status: 'pending',
        payment_provider: 'stripe',
        payment_method: 'card',
        is_free_booking: false,
        is_test: isTest,
        order_group_id: orderGroupId,
        human_code: humanReadableCode(bookingId),
      }
    })

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingInserts)
      .select()

    if (bookingError || !bookings || bookings.length === 0) {
      console.error('[stripe] booking_creation_failed', bookingError)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    const bookingId = bookings[0].id

    // Create Stripe PaymentIntent with complete booking context in metadata
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'hkd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId,
        userId: session.user.id,
        method,
        orderGroupId: orderGroupId || '',
        totalHours: totalHours.toString(),
        bookingCount: blocks.length.toString(),
        isTest: isTest.toString(),
        // Store block details for webhook recovery
        blocks: JSON.stringify(blocks.map(b => ({
          date: b.date,
          startHour: b.startHour,
          duration: b.duration,
          tableNumber: b.tableNumber,
        }))),
      },
    })

    // Create payment_attempt record
    await supabase.from('payment_attempts').insert({
      booking_id: bookingId,
      stripe_payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      provider: 'stripe',
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      bookingId,
      amount,
    })

  } catch (error) {
    console.error('[stripe] create_payment_intent_error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
