#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// First, get one booking to see all available columns
const { data: sample, error: sampleError } = await supabase
  .from('bookings')
  .select('*')
  .limit(1)
  .single()

if (sampleError) {
  console.error('Error fetching sample booking:', sampleError)
  process.exit(1)
}

console.log('Available columns in bookings table:')
console.log(Object.keys(sample).sort().join(', '))
console.log('')
