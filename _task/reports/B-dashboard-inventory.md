# Member Dashboard Feature Inventory

## Feature List

### 1. Authentication Guard
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/page.tsx:32-33, app/member/page.tsx:45-47
- **Loading state**: Yes — Evidence: app/member/page.tsx:14-23 (try-catch with fetchError handling)
- **Empty data state**: Yes — Evidence: app/member/page.tsx:35-47 (returns MemberAuthGuard when no data)
- **Error state**: Yes — Evidence: app/member/page.tsx:18-29 (logs error and shows AuthModal via MemberAuthGuard)
- **Mobile responsive**: Yes — Evidence: Entire page uses mobile-first responsive classes

### 2. Header with Back Button
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/MemberPageClient.tsx:30-48
- **Loading state**: N/A — Static header
- **Empty data state**: N/A — Always displays
- **Error state**: N/A — Static component
- **Mobile responsive**: Yes — Evidence: app/member/MemberPageClient.tsx:31 (max-w-7xl, responsive padding)

### 3. User Greeting in Header
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/MemberPageClient.tsx:42-44
- **Loading state**: N/A — Uses initialData prop
- **Empty data state**: Partial — Evidence: Fallback to '會員' when display_name is null
- **Error state**: N/A — Guarded by auth check
- **Mobile responsive**: Yes — Evidence: Responsive text sizing

### 4. Flippable Member Card (Front)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/MemberCardFlip.tsx:39-72
- **Loading state**: N/A — Uses profile prop from parent
- **Empty data state**: Partial — Evidence: Line 51 fallback to '會員', but assumes member_code exists
- **Error state**: N/A — Guarded by parent
- **Mobile responsive**: Yes — Evidence: app/member/components/MemberCardFlip.tsx:27 (max-w-md responsive container)

### 5. Flippable Member Card (Back - QR Code)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/MemberCardFlip.tsx:75-90
- **Loading state**: N/A — Uses profile.member_code
- **Empty data state**: No — Evidence: No handling if member_code is empty string
- **Error state**: N/A — QRCodeSVG handles empty values
- **Mobile responsive**: Yes — Evidence: Same responsive container as front

### 6. Member Card Flip Animation
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/MemberCardFlip.tsx:29-36 (Framer Motion rotateY animation)
- **Loading state**: N/A — Animation-only feature
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes — Evidence: 3D transform works on mobile

### 7. Tier Display with Color Coding
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/MemberCardFlip.tsx:22-24, lines 53-58, 100-111 (getTierRingColorPair, getTierGradient)
- **Loading state**: N/A — Uses profile.tier
- **Empty data state**: Yes — Evidence: Line 109 default case
- **Error state**: N/A
- **Mobile responsive**: Yes — Responsive badge sizing

### 8. Points Display
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/MemberCardFlip.tsx:67-68
- **Loading state**: N/A — Uses profile.points
- **Empty data state**: Yes — Evidence: getMemberRedesign.ts:47 (defaults to 0)
- **Error state**: N/A
- **Mobile responsive**: Yes — Responsive font sizing (text-3xl)

### 9. Action Grid (2x2)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:51-81
- **Loading state**: N/A — Static grid
- **Empty data state**: N/A — Always displays 4 tiles
- **Error state**: N/A
- **Mobile responsive**: Yes — Evidence: Line 51 (grid-cols-2 for mobile)

### 10. Help Action Tile
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:52-57
- **Loading state**: N/A — Static link
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes — Part of responsive grid

### 11. Wallet Action Tile (Locked Preview)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:59-65
- **Loading state**: N/A — Modal shows on click
- **Empty data state**: N/A
- **Error state**: Partial — Evidence: Line 44-45 silent catch on API failure
- **Mobile responsive**: Yes — Modal responsive (max-w-sm)

### 12. Wallet Notify-Me Toggle
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:108-122
- **Loading state**: No — No loading indicator during API call
- **Empty data state**: N/A
- **Error state**: Partial — Evidence: Line 44-46 (silent fail on opt-in save)
- **Mobile responsive**: Yes — Toggle works on mobile

### 13. Safety Action Tile
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:67-72
- **Loading state**: N/A — Static link
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes — Part of responsive grid

### 14. Inbox Action Tile with Badge
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:74-80
- **Loading state**: N/A — Uses profile.unread_notifications
- **Empty data state**: Yes — Evidence: Line 79 (badge only shows if > 0)
- **Error state**: N/A — Count defaults to 0 on error
- **Mobile responsive**: Yes — Badge positioning responsive

### 15. Upcoming Booking Card
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/UpcomingBookingCard.tsx:27-159
- **Loading state**: Yes — Evidence: Lines 65-70 (spinner during fetch)
- **Empty data state**: Yes — Evidence: Lines 72-84 (empty state with CTA button)
- **Error state**: Partial — Evidence: Lines 57-59 (silent fail, shows as empty)
- **Mobile responsive**: Yes — Responsive card layout

### 16. Upcoming Booking Details (Table, Date, Time, Price)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/UpcomingBookingCard.tsx:107-142
- **Loading state**: Yes — Inherited from parent card
- **Empty data state**: Yes — Shows empty state when no booking
- **Error state**: Partial — Falls back to '--' for null values (lines 113, 132)
- **Mobile responsive**: Yes — Evidence: Line 129 (grid-cols-3 layout)

### 17. QR Code Toggle for Booking
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/UpcomingBookingCard.tsx:98-103, 144-157
- **Loading state**: N/A — Instant show/hide
- **Empty data state**: N/A — Only available when booking exists
- **Error state**: N/A — QRCodeSVG handles rendering
- **Mobile responsive**: Yes — QR code scales properly

### 18. Past Bookings List (Last 5)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/PastBookingsList.tsx:26-154
- **Loading state**: Yes — Evidence: Lines 65-71 (spinner during fetch)
- **Empty data state**: Yes — Evidence: Lines 73-80 (empty state message)
- **Error state**: Partial — Evidence: Lines 58-60 (silent fail)
- **Mobile responsive**: Yes — Responsive list layout

### 19. Past Bookings "View All" Link
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/PastBookingsList.tsx:87-92
- **Loading state**: N/A — Static link
- **Empty data state**: N/A — Only shows when bookings exist
- **Error state**: N/A
- **Mobile responsive**: Yes — Link positioned responsively

### 20. Past Booking Details (Table, Date, Time, Price)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/PastBookingsList.tsx:97-136
- **Loading state**: Yes — Inherited from parent
- **Empty data state**: Yes — Shows empty state
- **Error state**: Partial — Evidence: Line 112 fallback to '--'
- **Mobile responsive**: Yes — Flex layout with responsive text

### 21. WhatsApp Contact Link for Refunds
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/PastBookingsList.tsx:139-151
- **Loading state**: N/A — Static link
- **Empty data state**: N/A — Always visible
- **Error state**: N/A
- **Mobile responsive**: Yes — Responsive text sizing

### 22. Bottom Links Section (4 links)
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:29-46
- **Loading state**: N/A — Static links
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes — Responsive card layout

### 23. Settings Link
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:32
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 24. Manage Account Link
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:33
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 25. Safety Link
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:34
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 26. Legal Link
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:35
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 27. App Version Display
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/BottomLinks.tsx:10-26, 38-43
- **Loading state**: No — No loading indicator during version fetch
- **Empty data state**: Yes — Evidence: Line 24 (defaults to '1.0.0' on error)
- **Error state**: Partial — Evidence: Line 23-25 (silent fail with fallback)
- **Mobile responsive**: Yes — Centered text

### 28. Admin Check for Wallet Access
- **Status**: ✅ IMPLEMENTED
- **Evidence**: app/member/components/ActionGrid.tsx:20-31, 183-194
- **Loading state**: No — No loading indicator during check
- **Empty data state**: N/A — Boolean result
- **Error state**: Partial — Evidence: Line 191-192 (silent fail, defaults to false)
- **Mobile responsive**: Yes — Modal behavior works on mobile

## OLD TAB-BASED DASHBOARD (MemberDashboard.tsx - Still in Codebase)

### 29. Tab Navigation System
- **Status**: ⚠️ PARTIAL (Old component, not used by new MemberPageClient)
- **Evidence**: app/member/MemberDashboard.tsx:488-527
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes — Evidence: Lines 473-546 (overflow scroll with fade)

### 30. Overview Tab
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:559-573, 936-1074
- **Loading state**: N/A
- **Empty data state**: Yes — Lines 1015-1018
- **Error state**: N/A
- **Mobile responsive**: Yes

### 31. Bookings Tab with History Toggle
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:574-617, 1136-1222
- **Loading state**: N/A
- **Empty data state**: Yes — Lines 1155-1181
- **Error state**: N/A
- **Mobile responsive**: Yes

### 32. Points Tab with Transaction History
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:619, 1363-1442
- **Loading state**: N/A
- **Empty data state**: Yes — Lines 1425-1427
- **Error state**: N/A
- **Mobile responsive**: Yes

### 33. Settings Tab
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:620, 1445-1759
- **Loading state**: Yes — Lines 1448-1449, 1453-1454
- **Empty data state**: N/A
- **Error state**: Yes — Lines 1469-1473, 1669-1672
- **Mobile responsive**: Yes

### 34. Access Tab (QR Guide)
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:621-623
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 35. Help Tab
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:624-626
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 36. Notification Bell with Unread Count
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:696-722
- **Loading state**: No — Lines 205-217 (fetch without loading state)
- **Empty data state**: Yes — Lines 784-787
- **Error state**: Partial — Lines 212-214 (silent fail)
- **Mobile responsive**: Yes

### 37. Notification Dropdown
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:746-820
- **Loading state**: No
- **Empty data state**: Yes — Lines 784-787
- **Error state**: N/A
- **Mobile responsive**: Yes — Fixed positioning

### 38. Tier Progress Bar
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:416-446
- **Loading state**: N/A
- **Empty data state**: Yes — Line 444 (handles max tier reached)
- **Error state**: N/A
- **Mobile responsive**: Yes

### 39. Statistics Cards (Bookings & Hours)
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:452-465, 825-841
- **Loading state**: N/A
- **Empty data state**: N/A
- **Error state**: N/A
- **Mobile responsive**: Yes

### 40. Delete Account Modal
- **Status**: ⚠️ PARTIAL (Old component)
- **Evidence**: app/member/MemberDashboard.tsx:1751-1757
- **Loading state**: N/A — Modal component handles internally
- **Empty data state**: N/A
- **Error state**: Yes — Modal handles error display
- **Mobile responsive**: Yes

## Summary

### New Dashboard (MemberPageClient.tsx + Components)
- **Total features found**: 28
- **Fully implemented**: 23
- **Partial**: 5
- **Missing**: 0

### Old Dashboard (MemberDashboard.tsx - Still in Codebase)
- **Total features found**: 12 (tab-based features)
- **Fully implemented**: 0 (not used by new page)
- **Partial**: 12 (old component still exists but not rendered)
- **Missing**: 0

### Missing Critical States

#### NEW DASHBOARD:
1. **Upcoming Booking Card** — Error state shows as empty instead of error message (silent fail)
2. **Past Bookings List** — Error state shows as empty instead of error message (silent fail)
3. **Wallet Notify Toggle** — No loading indicator during API save
4. **Admin Check** — No loading indicator during admin verification
5. **Version Display** — No loading indicator during version fetch
6. **Action Badge Count** — Silent fail on unread notification fetch (getMemberRedesign.ts:34-38)

#### OLD DASHBOARD (Not actively used):
7. **Notification Fetch** — No loading state during initial fetch
8. **Notification Bell** — Silent fail on fetch error

### Architecture Notes

1. **Two Parallel Implementations**: The codebase contains TWO complete member dashboard implementations:
   - **NEW**: MemberPageClient.tsx (mobile-first, single-scroll) — ACTIVE
   - **OLD**: MemberDashboard.tsx (tab-based, desktop-oriented) — INACTIVE but still in codebase

2. **Data Fetching**: New dashboard uses getMemberDashboardData() which is minimal (profile only). Booking data is fetched client-side by individual components.

3. **Error Handling Pattern**: Most errors are silently caught with fallback states. No explicit error UI except in old Settings tab.

4. **Mobile-First**: New dashboard is fully mobile-responsive using Tailwind's responsive utilities throughout.

5. **Component Structure**:
   - app/member/page.tsx (server component, auth guard)
   - app/member/MemberPageClient.tsx (client wrapper)
   - app/member/components/* (individual feature components)

### Recommended Actions

1. Add loading indicators to:
   - Wallet notify toggle save operation
   - Admin check for wallet access
   - Version fetch

2. Add explicit error states instead of silent fails to:
   - Upcoming booking fetch
   - Past bookings fetch
   - Unread notification count fetch

3. Consider removing or deprecating MemberDashboard.tsx if it's no longer used (confirm with team first).

4. Add empty string validation for member_code before rendering QR code on card back.
