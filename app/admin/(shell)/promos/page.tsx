/**
 * Admin Promotions page — 網站資料 → 「優惠碼」.
 *
 * Top section: `promotion_codes` management (the checkout-facing codes).
 * Below it: PromoCodesManager, the separate coupon_templates / campaigns
 * feature — left mounted and untouched.
 *
 * Design system: admin-theme.css variables only — no inline hex, no shadows.
 */

import PromotionCodesManager from '@/components/admin/PromotionCodesManager'
import PromoCodesManager from '@/components/admin/PromoCodesManager'

export default function AdminPromosPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="flex flex-col gap-1.5">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--admin-text)' }}
          data-cms-key="admin.promos.title"
        >
          優惠碼
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
          data-cms-key="admin.promos.subtitle"
        >
          管理結帳時使用的優惠碼，以及優惠券與推廣活動
        </p>
      </header>

      <PromotionCodesManager />

      {/* Separate feature — coupon_templates / user_coupons. Do not merge into
          the promotion_codes manager above. */}
      <PromoCodesManager />
    </main>
  )
}
