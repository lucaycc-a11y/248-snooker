import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import UatGateContent from './UatGateContent'

export const metadata: Metadata = {
  title: 'UAT Environment - Redirecting',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

// This page only renders for blocked UAT visitors.
// If they have a valid bypass cookie or are whitelisted, middleware lets them through.
export default function UatGatePage() {
  // Check if this is actually the UAT domain
  // If on production by mistake, redirect to production homepage
  const isUatDomain = process.env.NEXT_PUBLIC_APP_ENV === 'uat'

  if (!isUatDomain) {
    redirect('https://www.space8.com.hk')
  }

  return <UatGateContent />
}
