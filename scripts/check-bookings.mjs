#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const bookingIds = [
  'c7176c80-15db-491e-b79a-0957281669ea',
  'a2bc45e1-0f2f-400f-a56d-8dd68976e9dc'
]

console.log('Checking bookings status...\n')

const { data, error } = await supabase
  .from('bookings')
  .select('id, user_id, status, payment_provider, payment_method, total_price, date, start_time, end_time, created_at, updated_at')
  .in('id', bookingIds)
  .order('created_at', { ascending: false })

if (error) {
  console.error('Error querying bookings:', error)
  process.exit(1)
}

if (!data || data.length === 0) {
  console.log('No bookings found with these IDs')
} else {
  console.log(`Found ${data.length} booking(s):\n`)
  data.forEach((booking, i) => {
    console.log(`Booking ${i + 1}:`)
    console.log(`  ID: ${booking.id}`)
    console.log(`  Status: ${booking.status}`)
    console.log(`  Payment Provider: ${booking.payment_provider}`)
    console.log(`  Payment Method: ${booking.payment_method}`)
    console.log(`  Total Price: HK$${booking.total_price}`)
    console.log(`  Date: ${booking.date}`)
    console.log(`  Time: ${booking.start_time} - ${booking.end_time}`)
    console.log(`  Created: ${booking.created_at}`)
    console.log(`  Updated: ${booking.updated_at}`)
    console.log('')
  })
}
