import { getServiceSupabase } from '../lib/supabase/service.js'

const supabase = getServiceSupabase()

const bookingIds = [
  '159422b9-cbfe-4eda-a911-fe7de2e148cc',
  '075f3f2e-7564-427d-af0b-5b9cedd9e6a0'
]

console.log('Querying bookings...\n')

const { data, error } = await supabase
  .from('bookings')
  .select('id, status, payment_provider, provider_order_no, payment_method, created_at, updated_at, total_price, user_id, order_group_id')
  .in('id', bookingIds)
  .order('created_at', { ascending: false })

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log('Found', data.length, 'bookings:\n')
data.forEach(b => {
  console.log('Booking ID:', b.id)
  console.log('Status:', b.status)
  console.log('Payment Provider:', b.payment_provider)
  console.log('Provider Order No:', b.provider_order_no)
  console.log('Payment Method:', b.payment_method)
  console.log('Created:', b.created_at)
  console.log('Updated:', b.updated_at)
  console.log('Total Price:', b.total_price)
  console.log('User ID:', b.user_id)
  console.log('Order Group ID:', b.order_group_id)
  console.log('---')
})
