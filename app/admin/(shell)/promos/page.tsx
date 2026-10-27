/**
 * Admin Promotions page — 網站資料 → 「優惠碼」.
 *
 * Top section: `promotion_codes` management (the checkout-facing codes).
 * Below it: PromoCodesManager, the separate coupon_templates / campaigns
 * feature — left mounted and untouched.
 *
 * Design system: admin-theme.css variables only — no inline hex, no shadows.
 */

import AdminQuickLinks from '@/components/admin/AdminQuickLinks'
import PromotionCodesManager from '@/components/admin/PromotionCodesManager'
import PromoCodesManager from '@/components/admin/PromoCodesManager'

export default function AdminPromosPage() {
  return (
    <div className="admin-stack">
      <header className="flex flex-col gap-1.5">
        <p
          className="text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
          data-cms-key="admin.promos.subtitle"
        >
          管理結帳時使用的優惠碼，以及優惠券與推廣活動
        </p>
      </header>

      <AdminQuickLinks current="promos" />

      <PromotionCodesManager />

      {/* Separate feature — coupon_templates / user_coupons. Do not merge into
          the promotion_codes manager above. */}
      <PromoCodesManager />
    </div>
  )
}
