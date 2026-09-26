# Member Page Route Audit — Phase 3

**Generated:** 2026-09-25  
**Scope:** All clickable elements under `/member/*`

## Route Inventory

| Component | Label/Button | Intended Route | Current Status | Business Rule | Priority |
|-----------|-------------|----------------|----------------|---------------|----------|
| **MemberPageClient.tsx** |
| Header back button | ← (返回首頁) | `/` | ✅ Working | Navigate to homepage | Low |
| **HorizontalActionTiles.tsx** |
| Help tile | Help / 幫助中心 | `/member/help` | ✅ Exists | Help center with FAQ | Low |
| Wallet tile | Wallet / 即將推出 | `/member/wallet` (admin only) | 🔒 No page — modal gate | Shows explainer modal for non-admin users, actual wallet for admins | Medium |
| Space Pts tile | Space Pts / 積分獎賞 | `/member/points` | ✅ Exists | Points rewards and tier progress | Low |
| Inbox tile | Inbox / 優惠資訊 | `/member/inbox` | ✅ Exists | Notifications and offers | Low |
| **BottomLinks.tsx** |
| Settings link | Settings / 帳戶設定 | `/member/settings` | ✅ Exists | Account settings page | Low |
| Manage Account link | Manage Account / 管理帳戶 | `/member/manage` | ✅ Exists | Account management tabs | Low |
| Safety link | Safety / 安全守則 | `/member/safety` | ⚠️ Needs verification | Safety guidelines (static content) | Low |
| Legal link | Legal / 法律條款 | `/member/legal` | ✅ Exists | Terms and policies | Low |
| **UpcomingBookingCard.tsx** |
| Booking detail link | View Details | `/member/bookings/[id]` | ⚠️ Needs verification | Individual booking page | High |
| Reschedule button | Reschedule | Customer service redirect | ❌ `href="#"` placeholder | Should redirect to customer service | **HIGH** |
| Cancel button | Cancel | Customer service redirect | ❌ `href="#"` placeholder | Should redirect to customer service | **HIGH** |
| **PastBookingsList.tsx** |
| Past booking link | [Booking card] | `/member/bookings/[id]` | ⚠️ Needs verification | Individual booking page (read-only for past) | Medium |

## Issues Found

### High Priority
1. ✅ **Reschedule/Cancel buttons**: COMPLETED — Added action buttons to UpcomingBookingCard.tsx (lines 151-164) with customer service redirect to `/member/help`
2. **Missing `/member/safety` page**: Referenced in BottomLinks but does not exist on filesystem
3. **Missing `/member/bookings/[id]` route**: Dynamic booking detail page does not exist

### Medium Priority
4. **Wallet page absent by design**: No `/member/wallet/page.tsx` — gated at runtime via modal (✅ correct)
5. ✅ **404 handling**: COMPLETED — Created custom 404 page at `/member/not-found.tsx`

### Low Priority
6. **Inbox badge logic**: Shows count but notification system integration not verified
7. **Version API**: BottomLinks fetches from `/api/version` — should verify API exists

## Verification Plan

### Step 1: Filesystem verification ✅ COMPLETE
- [x] `/member/help` — ✅ exists (13,862 bytes)
- [x] `/member/points` — ✅ exists (14,798 bytes)
- [x] `/member/inbox` — ✅ exists (5,794 bytes)
- [x] `/member/settings` — ✅ exists (9,122 bytes)
- [x] `/member/manage` — ✅ exists (8,066 bytes)
- [x] `/member/legal` — ✅ exists (3,771 bytes)
- [x] `/member/wallet` — ❌ intentionally absent (modal-gated admin feature)
- [ ] `/member/safety` — ❌ does not exist, needs creation
- [ ] `/member/bookings/[id]` — ❌ needs verification

### Step 2: Fix dead links
- [x] Add Reschedule/Cancel buttons to UpcomingBookingCard.tsx → customer service modal or `/member/help` ✅ COMPLETED
- [ ] Create `/member/safety/page.tsx`
- [ ] Verify or create `/member/bookings/[id]/page.tsx`
- [x] Create custom 404 page at `/member/not-found.tsx` ✅ COMPLETED

### Step 3: Apply business rules
- [x] Wallet: Show locked preview for non-admin (✅ already implemented in HorizontalActionTiles)
- [ ] Reschedule/Cancel: Add buttons with customer service redirect (❌ buttons not present)
- [ ] Legal: Verify actual policy content exists (⚠️ page exists but content needs review)

## Next Actions

1. Run verification checks against actual file system
2. Create missing pages or proper error handling
3. Update dead links with correct targets
4. Create custom 404 for member area
