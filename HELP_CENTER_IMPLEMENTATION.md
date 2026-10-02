# Help Center Implementation Report

## Step 0 Findings

### ✅ Confirmed
- **FAQ Route**: `/app/[locale]/faq/page.tsx` with `components/landing/FAQ.tsx`
- **i18n**: `next-intl` with locales `zh-HK` (default), `zh-CN`, `en`
- **Supabase**: Service role client at `lib/supabase/service.ts`
- **Rate limit**: `lib/rate-limit.ts` with `check_rate_limit` RPC
- **help_feedback table**: Exists and accessible
- **Config data**: All pricing, booking, door, points data confirmed
- **WhatsApp**: 85261808022 (from `lib/site/contact.ts`)
- **Member QR**: `/app/member/page.tsx` with `MemberCard` flip component

### ❌ Blockers
1. **help-assets folder missing** - User needs to copy `help-assets/` with images and icons
2. **Venue section anchors missing** - Cannot link to facilities, weather, directions, notices
3. **Safety page not found** - Need to locate or confirm it doesn't exist

### ⚠️ Route Findings
- Legal pages: `/legal` (main), `/legal/refund-policy`, `/privacy`, `/terms`
- Venue: `/venue` (no section anchors found in VenueContent.tsx)
- Member QR: `/member` (card flips to show QR on back)

### 📊 Config Values (Live DB)
- Prices: HK$88 / HK$98 / HK$108
- Times: 06:00-12:00 / 12:00-18:00 / 18:00-24:00
- Booking: 1h min, 30 days ahead
- Door: 10 min early, 10 min late
- Overstay: HK$50 per 15min
- Points: 1 pt/HK$1, 100→10 credits, 100 signup bonus

## Next Actions
1. Wait for user to copy help-assets folder
2. Check venue page for actual section IDs
3. Confirm safety page location or create placeholder links
4. Implement Help Center structure
