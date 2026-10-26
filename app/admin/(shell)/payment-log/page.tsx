import PaymentMonitorClient from '@/components/admin/PaymentMonitorClient'

// 付款監控 — live view of payments, issues and per-booking timelines.
// Auth is enforced by app/admin/layout.tsx (getAdminData) and by the API routes.

export const dynamic = 'force-dynamic'

export default function PaymentLogPage() {
  return <PaymentMonitorClient />
}
