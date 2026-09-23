#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReschedules() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, user_id, date, start_time, end_time, table_number, rescheduled_at, created_at')
    .not('rescheduled_at', 'is', null)
    .order('rescheduled_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`\n📊 Found ${data.length} reschedule record(s)\n`);

  if (data.length === 0) {
    console.log('✅ No reschedule records found in database.');
  } else {
    data.forEach((booking, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  Booking ID: ${booking.id}`);
      console.log(`  User ID: ${booking.user_id}`);
      console.log(`  Date: ${booking.date}`);
      console.log(`  Time: ${booking.start_time} - ${booking.end_time}`);
      console.log(`  Table: ${booking.table_number}`);
      console.log(`  Rescheduled at: ${booking.rescheduled_at}`);
      console.log(`  Originally created: ${booking.created_at}`);
      console.log('');
    });
  }
}

checkReschedules().catch(console.error);
