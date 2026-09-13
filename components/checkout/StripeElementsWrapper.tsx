'use client'

import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { useEffect, useState } from 'react'

let stripePromise: Promise<Stripe | null> | null = null

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
      return null
    }
    stripePromise = loadStripe(key)
  }
  return stripePromise
}

interface StripeElementsWrapperProps {
  clientSecret: string
  children: React.ReactNode
}

export default function StripeElementsWrapper({
  clientSecret,
  children,
}: StripeElementsWrapperProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null)

  useEffect(() => {
    const promise = getStripe()
    if (promise) {
      promise.then(setStripe)
    }
  }, [])

  if (!stripe) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">載入付款...</div>
      </div>
    )
  }

  return (
    <Elements
      stripe={stripe}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#000000',
            colorBackground: '#ffffff',
            colorText: '#1a1a1a',
            colorDanger: '#df1b41',
            fontFamily: 'system-ui, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      }}
    >
      {children}
    </Elements>
  )
}
