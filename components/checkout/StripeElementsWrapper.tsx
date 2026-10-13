'use client'

import { Elements } from '@stripe/react-stripe-js'
import { Stripe } from '@stripe/stripe-js'
import { useEffect, useState } from 'react'
import { getPreloadedStripe } from '@/lib/stripe/preload'

interface StripeElementsWrapperProps {
  clientSecret: string
  children: React.ReactNode
}

/**
 * Stripe Elements wrapper that uses preloaded Stripe.js instance.
 *
 * IMPORTANT: Call `preloadStripe()` early in the booking flow (e.g., page mount)
 * so Stripe.js downloads in the background. By the time user reaches this component,
 * the SDK is already loaded — no blocking wait.
 *
 * Loading state with skeleton prevents layout shift when Stripe elements mount.
 */
export default function StripeElementsWrapper({
  clientSecret,
  children,
}: StripeElementsWrapperProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null)

  useEffect(() => {
    const promise = getPreloadedStripe()
    if (promise) {
      promise.then(setStripe)
    }
  }, [])

  if (!stripe) {
    // Skeleton UI with reserved space to prevent layout shift
    return (
      <div className="space-y-4 py-4">
        {/* Payment form skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-12 bg-gray-100 rounded-lg border border-gray-200 animate-pulse" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-12 bg-gray-100 rounded-lg border border-gray-200 animate-pulse" />
        </div>

        <div className="text-xs text-gray-400 text-center py-2">
          載入安全付款...
        </div>
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
