#!/usr/bin/env node
// Ensures lib/supabase/legacy.ts (untyped clients for schema-drifted code) is only
// imported by an explicit allow-list. The list can only shrink: fix the schema or
// delete the feature, never add new legacy imports.

import { readFileSync } from 'fs'
import { globSync } from 'glob'

const ALLOW_LIST = [
  'app/api/admin/ai-settings/route.ts',
  'app/api/admin/audit/route.ts',
  'app/api/admin/blog/[id]/route.ts',
  'app/api/admin/blog/route.ts',
  'app/api/admin/blog/translate/route.ts',
  'app/api/admin/bookings/[id]/audit-log/route.ts',
  'app/api/admin/bookings/[id]/cancel/route.ts',
  'app/api/admin/bookings/manual-create/route.ts',
  'app/api/admin/bookings/manual-slot-check/route.ts',
  'app/api/admin/campaigns/[id]/route.ts',
  'app/api/admin/campaigns/route.ts',
  'app/api/admin/config/route.ts',
  'app/api/admin/coupons/[id]/route.ts',
  'app/api/admin/coupons/route.ts',
  'app/api/admin/door/cards/[id]/route.ts',
  'app/api/admin/door/register-request/[id]/cancel/route.ts',
  'app/api/admin/door/register-request/[id]/confirm/route.ts',
  'app/api/admin/door/register-request/route.ts',
  'app/api/admin/exchange-session/route.ts',
  'app/api/admin/health/route.ts',
  'app/api/admin/lockers/route.ts',
  'app/api/admin/login/route.ts',
  'app/api/admin/members/[id]/route.ts',
  'app/api/admin/notifications/route.ts',
  'app/api/admin/payment-log/reconcile/route.ts',
  'app/api/admin/promos/[id]/route.ts',
  'app/api/admin/promos/route.ts',
  'app/api/admin/users/route.ts',
  'app/api/admin/venue/route.ts',
  'app/api/deploy/go-live/route.ts',
  'app/api/deploy/push-to-maintenance/route.ts',
  'app/api/dev2/deploy/route.ts',
  'app/api/dev2/env-info/route.ts',
  'app/api/dev2/git-status/route.ts',
  'app/api/dev2/ip-whitelist/route.ts',
  'app/api/dev2/test-bookings/route.ts',
  'app/api/dev2/test-price/route.ts',
  'app/api/dev2/test-pricing/route.ts',
  'app/api/gate/status/route.ts',
  'app/api/help-center/feedback/route.ts',
  'app/api/pilot/booking-status/route.ts',
  'app/api/pilot/check-renewal/route.ts',
  'app/api/pilot/complete-guest-join/route.ts',
  'app/api/pilot/create-renewal-order/route.ts',
  'app/api/pilot/login/route.ts',
  'app/api/pilot/logout/route.ts',
  'app/api/pilot/session/route.ts',
  'app/api/uat/env-info/route.ts',
  'app/api/uat/ip-whitelist/route.ts',
  'app/api/uat/test-bookings/refund/route.ts',
  'app/api/uat/test-pricing/route.ts',
  'app/api/webhooks/kpay/route.ts',
  'app/api/webhooks/stripe/route.ts',
  'app/coming-soon/page.tsx',
  'components/admin/widgets/AnomalyWidget.tsx',
  'components/admin/widgets/PendingWidget.tsx',
  'lib/admin/actionExecutor.ts',
  'lib/admin/aiTools.ts',
  'lib/ai/tools.ts',
  'lib/auth/route-guards.ts',
  'lib/booking/server.ts',
  'lib/data/getAdminBookings.ts',
  'lib/data/getAdminDoorCards.ts',
  'lib/data/getAdminMembers.ts',
  'lib/data/getAiWidgetSettings.ts',
  'lib/data/getMemberRedesign.ts',
  'lib/errors/log.ts',
  'lib/pilot/session.ts',
  'lib/resend/template-send.ts',
  'lib/security/admin-wrapper.ts',
  'lib/security/audit-log.ts',
  'middleware.ts',
  'scripts/check-pricing-config.ts',
  'scripts/reconcile-stuck-bookings.ts',
  'scripts/verify-and-fix-pricing.ts',
]

const files = globSync('{app,components,lib,middleware.ts,scripts}/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**', '**/*.d.ts'],
})

const violations = []

for (const file of files) {
  const content = readFileSync(file, 'utf8')
  if (content.includes("from '@/lib/supabase/legacy'") || content.includes('from "@/lib/supabase/legacy"')) {
    if (!ALLOW_LIST.includes(file)) {
      violations.push(file)
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Legacy untyped Supabase client imported in non-allowed files:')
  violations.forEach(f => console.error(`   ${f}`))
  console.error('\nFix the schema or delete the feature. Do not add to the allow-list.')
  process.exit(1)
}

console.log('✅ No unauthorized legacy client imports')
