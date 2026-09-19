import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import UatGateContent from './UatGateContent'

export const metadata: Metadata = {
  title: 'SPACE8 — 內部測試中',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function UatGatePage() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'uat') {
    redirect('https://www.space8.com.hk')
  }

  // App Router page components cannot set response status directly, but
  // next.config.ts headers() rules and middleware can inject response headers.
  // The 503 status + Retry-After + X-Robots-Tag are applied in middleware.ts
  // for every request that reaches /uat-gate, including the initial redirect.
  void await headers() // ensure dynamic rendering

  return <UatGateContent />
}
