/**
 * Admin Promotions page — coupon templates & campaigns (spec §8).
 *
 * Renders PromoCodesManager inside a CMS-keyed page shell.
 * Design system: admin-theme.css variables only — no inline hex, no shadows.
 */

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
          Promotions
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--admin-text-muted)' }}
          data-cms-key="admin.promos.subtitle"
        >
          Manage coupon templates and campaigns.
        </p>
      </header>

      <PromoCodesManager />
    </main>
  )
}
