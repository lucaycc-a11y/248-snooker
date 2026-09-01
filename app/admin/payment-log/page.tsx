import { Suspense } from 'react'
import PaymentLogClient from '@/components/admin/PaymentLogClient'

export const metadata = { title: 'Payment Log — Space8 Admin' }

export default function AdminPaymentLogPage() {
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-[var(--admin-text)] lg:text-3xl"
          data-cms-key="admin_payment_log_title"
        >
          Payment Log
        </h1>
        <p
          className="mt-1 text-sm text-[var(--admin-text-muted)]"
          data-cms-key="admin_payment_log_subtitle"
        >
          Independent audit of all payment attempts with anomaly detection.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--admin-brand)] border-t-transparent" />
          </div>
        }
      >
        <PaymentLogClient />
      </Suspense>
    </main>
  )
}
