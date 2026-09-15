import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'

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

    // Calculate total amount
    const totalHours = blocks.reduce((sum, b) => sum + b.duration, 0)
    const amount = Math.round(totalHours * hourlyRate * 100) // in cents

    // Create bookings in database (status: pending)
    const bookingInserts = blocks.map((block) => ({
      user_id: session.user.id,
      date: block.date,
      start_time: `${block.startHour.toString().padStart(2, '0')}:00`,
      end_time: `${(block.startHour + block.duration).toString().padStart(2, '0')}:00`,
      duration_hours: block.duration,
      table_number: block.tableNumber,
      total_price: block.duration * hourlyRate,
      status: 'pending',
      payment_provider: 'stripe',
      payment_method: 'card',
      is_free_booking: false,
    }))

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingInserts)
      .select()

    if (bookingError || !bookings || bookings.length === 0) {
      console.error('[stripe] booking_creation_failed', bookingError)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    const bookingId = bookings[0].id

    // Create Stripe PaymentIntent
    const stripe = getStripe()
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'hkd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingId,
        userId: session.user.id,
        method,
        blocks: JSON.stringify(blocks),
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
