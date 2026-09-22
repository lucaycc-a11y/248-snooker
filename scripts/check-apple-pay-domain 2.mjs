import { getStripe } from '../lib/stripe/server.js'

const stripe = getStripe()

console.log('Checking Apple Pay domain verification status...\n')

try {
  const domain = await stripe.paymentMethodDomains.retrieve('pmd_1UGHfA5S9CcpaekNapF1Jad0')

  console.log('Domain:', domain.domain_name)
  console.log('Status:', domain.enabled ? 'ENABLED' : 'DISABLED')
  console.log('Created:', new Date(domain.created * 1000).toISOString())
  console.log('\nApple Pay Status:', domain.apple_pay?.status_details?.status || 'N/A')

  if (domain.apple_pay?.status_details?.status === 'active') {
    console.log('✅ Apple Pay domain verification is ACTIVE')
  } else if (domain.apple_pay?.status_details?.status === 'pending') {
    console.log('⏳ Apple Pay domain verification is PENDING')
    console.log('\nVerification file needed at:')
    console.log('https://space8.com.hk/.well-known/apple-developer-merchantid-domain-association')
  } else {
    console.log('❌ Apple Pay domain verification status:', domain.apple_pay?.status_details?.status)
    if (domain.apple_pay?.status_details?.error_message) {
      console.log('Error:', domain.apple_pay.status_details.error_message)
    }
  }

  console.log('\nFull response:')
  console.log(JSON.stringify(domain, null, 2))
} catch (error) {
  console.error('Error:', error.message)
  process.exit(1)
}
