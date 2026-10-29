import PaymentSystemPanel from '@/components/admin/PaymentSystemPanel'
import PaymentXPanel from '@/components/admin/PaymentXPanel'

// 後台 → 系統 → 支付系統. Auth is enforced by app/admin/layout.tsx; the public-system switch
// itself is super_admin-only and re-checked server-side in /api/admin/payment-system.
export default function AdminPaymentSystemPage() {
  return (
    <div className="admin-stack">
      <PaymentSystemPanel />
      <PaymentXPanel />
    </div>
  )
}
