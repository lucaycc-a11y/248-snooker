'use client'

import { useEffect, useState } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { PaymentMethodId } from './PaymentMethodList'

interface StripeCheckoutPaymentProps {
  clientSecret: string
  method: PaymentMethodId
  onSuccess: () => void
  onError: (error: string) => void
}

export default function StripeCheckoutPayment({
  clientSecret,
  method,
  onSuccess,
  onError,
}: StripeCheckoutPaymentProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [walletFallbackMessage, setWalletFallbackMessage] = useState<string>('')

  // Auto-trigger wallet payment for Google Pay / Apple Pay
  useEffect(() => {
    if (!stripe || !elements) return
    if (method !== 'google_pay' && method !== 'apple_pay') return

    const attemptWalletPayment = async () => {
      // Check if wallet is available
      const paymentRequest = stripe.paymentRequest({
        country: 'HK',
        currency: 'hkd',
        total: { label: 'Space8 Booking', amount: 100 }, // Will be replaced by actual amount
        requestPayerName: true,
        requestPayerEmail: true,
      })

      const canMakePayment = await paymentRequest.canMakePayment()
      const walletName = method === 'google_pay' ? 'Google Pay' : 'Apple Pay'

      if (!canMakePayment || (method === 'google_pay' && !canMakePayment.googlePay) || (method === 'apple_pay' && !canMakePayment.applePay)) {
        // Wallet not supported — auto-fallback to credit card form
        setWalletFallbackMessage(`此裝置不支援 ${walletName}，已切換至信用卡付款`)
        return
      }

      // Wallet supported — trigger payment
      paymentRequest.on('paymentmethod', async (ev) => {
        setIsProcessing(true)
        const { error: confirmError } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        )

        if (confirmError) {
          ev.complete('fail')
          onError(confirmError.message || '付款失敗')
          setIsProcessing(false)
        } else {
          ev.complete('success')
          onSuccess()
        }
      })

      paymentRequest.show()
    }

    attemptWalletPayment()
  }, [stripe, elements, method, clientSecret, onSuccess, onError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/book?payment=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message || '付款失敗')
      setIsProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="space-y-4">
      {walletFallbackMessage && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {walletFallbackMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <PaymentElement
          options={{
            layout: 'tabs',
            fields: {
              billingDetails: {
                email: 'auto',
              },
            },
          }}
        />

        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="mt-4 w-full rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
        >
          {isProcessing ? '處理中...' : '確認付款'}
        </button>
      </form>
    </div>
  )
}
