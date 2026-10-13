# Bug-Bash Scenarios - Member Area (Phase D)

Manual test scenarios for wallet, points, inbox, and home tiles.
Focus on edge cases, error states, and UX scenarios that automated tests can't fully capture.

---

## 1. Wallet Page (`/member/wallet`)

### 1.1 Balance Display Edge Cases
- [ ] **Zero balance**: Balance = 0, no held amount
  - Expected: Shows HK$0, "Add Credit" button prominent
- [ ] **Negative available balance**: Balance = 50, Held = 60
  - Expected: Available shows HK$-10 (or handles gracefully)
- [ ] **Large balance**: Balance = 999,999
  - Expected: Number formatting with commas, no overflow
- [ ] **Decimal precision**: Balance = 123.45
  - Expected: Displays HK$123.45 correctly

### 1.2 Ledger History
- [ ] **Empty ledger**: New user with no transactions
  - Expected: Shows empty state with helpful message
- [ ] **Single transaction**: Only one ledger entry
  - Expected: Displays correctly without layout issues
- [ ] **100+ transactions**: Scroll and pagination
  - Expected: Smooth scrolling, "Load More" works, no performance lag
- [ ] **Transaction with null booking**: Manual adjustment entry
  - Expected: Displays without booking details, no crash
- [ ] **Very long note text**: 200+ character note
  - Expected: Text truncates or wraps gracefully

### 1.3 Offers Section
- [ ] **No available offers**: Empty available array
  - Expected: Shows "No offers available" message
- [ ] **No used offers**: Empty used array
  - Expected: Shows "You haven't used any offers yet" message
- [ ] **Expired offer**: Offer with `validUntil` in the past
  - Expected: Either filtered out or marked as expired
- [ ] **Offer with null maxDiscount**: No maximum discount cap
  - Expected: Displays without max discount info

### 1.4 Loading & Error States
- [ ] **Slow network**: Simulate 3G connection
  - Expected: Loading skeleton shows, no blank screen
- [ ] **API timeout**: Backend takes >10 seconds
  - Expected: Error message with retry button
- [ ] **401 Unauthorized**: Session expired
  - Expected: Redirects to login
- [ ] **500 Server Error**: Backend failure
  - Expected: User-friendly error message, retry option

---

## 2. Points Page (`/member/points`)

### 2.1 Summary Card Edge Cases
- [ ] **Zero points**: Lifetime = 0, Redeemable = 0
  - Expected: Shows 0 points, welcome message for new users
- [ ] **Exactly at threshold**: Redeemable = 100 (exactly 1 block)
  - Expected: Progress bar shows 0/100 for next block
- [ ] **Very large points**: Lifetime = 50,000
  - Expected: Number formatting with commas, no overflow
- [ ] **Points converted**: User has converted some points to wallet
  - Expected: "Deposited to Wallet" shows correct HK$ amount

### 2.2 Transaction History
- [ ] **Empty history**: New user with no transactions
  - Expected: Shows empty state per filter
- [ ] **Filter: All**: Mixed earn/wallet/back transactions
  - Expected: All transaction types display correctly
- [ ] **Filter: Earn**: Only positive point entries
  - Expected: Only shows earn transactions, no negative amounts
- [ ] **Filter: Wallet**: Only convert/signup entries
  - Expected: Shows only wallet deposits with HK$ amounts
- [ ] **Filter: Back**: Only reversal entries
  - Expected: Shows only negative amounts (refunds)

### 2.3 Transaction Details
- [ ] **Booking transaction**: Transaction linked to booking
  - Expected: Shows booking reference as link
- [ ] **Manual adjustment**: Transaction with no booking
  - Expected: Shows "System Adjustment" or similar
- [ ] **Null paidHkd**: Non-booking transaction
  - Expected: Doesn't show HK$ paid amount
- [ ] **Signup bonus**: First transaction for new user
  - Expected: Shows as "Welcome Gift" or similar

### 2.4 How It Works & Tier Benefits
- [ ] **Expand "How It Works"**: Click accordion
  - Expected: Shows 6 rules clearly, can collapse again
- [ ] **Expand "Tier Benefits"**: Click accordion
  - Expected: Shows tier benefits, matches user's current tier
- [ ] **Mobile view**: Test on narrow viewport
  - Expected: Accordions stack, readable on mobile

### 2.5 Loading & Error States
- [ ] **Slow network**: Simulate 3G connection
  - Expected: Loading skeleton for summary and transactions
- [ ] **API error**: Backend returns 500
  - Expected: Error state with retry button
- [ ] **Partial load**: Summary loads but transactions fail
  - Expected: Shows summary, error for transactions only

---

## 3. Inbox Page (`/member/inbox`)

### 3.1 Message List Edge Cases
- [ ] **Empty inbox**: No messages
  - Expected: Shows empty state with icon and message
- [ ] **All read messages**: No unread messages
  - Expected: No unread indicators, counts show 0
- [ ] **All unread messages**: All messages unread
  - Expected: All messages have unread indicator
- [ ] **100+ messages**: Large inbox
  - Expected: Scrolls smoothly, performant rendering

### 3.2 Filters
- [ ] **Filter: All**: Default view
  - Expected: Shows all message types
- [ ] **Filter: Credit**: Wallet-related messages
  - Expected: Only shows credit/wallet messages
- [ ] **Filter: Promo**: Promotional messages
  - Expected: Only shows promo messages
- [ ] **Filter: System**: System messages
  - Expected: Only shows system messages
- [ ] **Empty filter result**: Filter with no matching messages
  - Expected: Shows "No messages" for that filter

### 3.3 Message Detail
- [ ] **Click unread message**: Opens detail view
  - Expected: Message marked as read, detail view shows full content
- [ ] **Click read message**: Opens detail view
  - Expected: Detail view shows, no state change
- [ ] **Long message content**: 1000+ character message
  - Expected: Content scrolls or wraps, readable
- [ ] **Back button**: From detail view
  - Expected: Returns to message list, preserves filter

### 3.4 Message Types & Icons
- [ ] **Credit type**: Wallet notification
  - Expected: Shows wallet icon, "Wallet Notification" badge
- [ ] **Promo type**: Promotional offer
  - Expected: Shows promo icon, "Promotional Activity" badge
- [ ] **System type**: System notification
  - Expected: Shows envelope icon, "System Notification" badge

### 3.5 Day Grouping
- [ ] **Today's messages**: Messages from today
  - Expected: Grouped under "Today" header
- [ ] **Yesterday's messages**: Messages from yesterday
  - Expected: Grouped under "Yesterday" header
- [ ] **Older messages**: Messages from previous days
  - Expected: Grouped by date (e.g., "Oct 3, 2026")

### 3.6 Loading & Error States
- [ ] **Slow network**: Simulate 3G connection
  - Expected: Loading skeleton shows message placeholders
- [ ] **API error**: Backend returns 500
  - Expected: Error alert with retry button
- [ ] **Mark read fails**: Network error during mark-read
  - Expected: Message stays unread, silent retry or error

---

## 4. Home Tiles (`/member` - Quick Actions)

### 4.1 Tile Display
- [ ] **All tiles render**: 4 quick action tiles visible
  - Expected: Wallet, Points, Inbox, Settings tiles
- [ ] **Tile order**: Consistent ordering
  - Expected: Matches design order (Wallet, Points, Inbox, Settings)
- [ ] **Mobile view**: Tiles on narrow viewport
  - Expected: Grid adapts, readable on mobile

### 4.2 Tile Navigation
- [ ] **Click Wallet tile**: Navigates to wallet page
  - Expected: URL changes to `/member/wallet`
- [ ] **Click Points tile**: Navigates to points page
  - Expected: URL changes to `/member/points`
- [ ] **Click Inbox tile**: Navigates to inbox page
  - Expected: URL changes to `/member/inbox`
- [ ] **Click Settings tile**: Navigates to settings page
  - Expected: URL changes to `/member/settings`

### 4.3 Tile Badges & Indicators
- [ ] **Inbox unread count**: User has unread messages
  - Expected: Red badge shows unread count on Inbox tile
- [ ] **Zero unread**: No unread messages
  - Expected: No badge shown on Inbox tile
- [ ] **Large unread count**: 99+ unread messages
  - Expected: Badge shows "99+" or truncates gracefully

---

## 5. Cross-Page Scenarios

### 5.1 Navigation Flow
- [ ] **Home → Wallet → Back**: Navigate and use back button
  - Expected: Smooth navigation, browser back works
- [ ] **Home → Points → Wallet → Inbox**: Multi-page flow
  - Expected: All pages load correctly, no state loss
- [ ] **Direct URL access**: `/member/wallet` while logged out
  - Expected: Redirects to login with return URL

### 5.2 Session & Auth
- [ ] **Session timeout**: Session expires while on page
  - Expected: Next API call redirects to login
- [ ] **Logout while on page**: Click logout from member page
  - Expected: Clears session, redirects to home
- [ ] **Login from different device**: Same user, two sessions
  - Expected: Both sessions work independently

### 5.3 i18n & Localization
- [ ] **Switch to zh-CN**: Change locale to Simplified Chinese
  - Expected: All text updates to zh-CN, no missing keys
- [ ] **Switch to en**: Change locale to English
  - Expected: All text updates to en, no missing keys
- [ ] **Switch back to zh-HK**: Return to Traditional Chinese
  - Expected: All text updates to zh-HK, default locale

### 5.4 Responsive & Accessibility
- [ ] **Mobile (375px)**: iPhone SE width
  - Expected: All pages readable, no horizontal scroll
- [ ] **Tablet (768px)**: iPad width
  - Expected: Layout adapts, good use of space
- [ ] **Desktop (1440px)**: Wide screen
  - Expected: Content centered or uses space well
- [ ] **Screen reader**: Test with VoiceOver/NVDA
  - Expected: Meaningful labels, navigable structure
- [ ] **Keyboard navigation**: Tab through pages
  - Expected: Focus visible, all interactive elements accessible

---

## 6. Performance & Polish

### 6.1 Performance
- [ ] **Initial page load**: Time to interactive
  - Expected: Under 2 seconds on 3G
- [ ] **Page transitions**: Navigation between pages
  - Expected: Smooth, no visible lag
- [ ] **Scroll performance**: Long lists (100+ items)
  - Expected: 60fps scrolling, no jank

### 6.2 Animations & Transitions
- [ ] **Loading states**: Skeleton screens
  - Expected: Smooth fade-in, no content jump
- [ ] **Filter transitions**: Change filters on points/inbox
  - Expected: Content updates smoothly
- [ ] **Modal/detail views**: Open inbox message detail
  - Expected: Smooth slide or fade transition

### 6.3 Error Recovery
- [ ] **Network loss during load**: Kill network mid-load
  - Expected: Shows error state, retry button works
- [ ] **Network restored**: Retry after network restored
  - Expected: Page loads successfully
- [ ] **Partial data load**: Some API calls succeed, others fail
  - Expected: Shows loaded data, errors for failed sections

---

## Testing Checklist Summary

**Priority 1 - Critical Functionality**
- [ ] All pages load without crashes
- [ ] API contracts match TypeScript types
- [ ] Authentication and authorization work
- [ ] Navigation between pages works
- [ ] Empty states display correctly
- [ ] Error states show user-friendly messages

**Priority 2 - Data Edge Cases**
- [ ] Zero/null/empty data scenarios
- [ ] Large numbers and long text
- [ ] All filter options work
- [ ] Pagination and "load more" work

**Priority 3 - UX Polish**
- [ ] Loading states show skeletons
- [ ] Animations are smooth
- [ ] Mobile responsive layout works
- [ ] i18n switches correctly (zh-HK, zh-CN, en)

**Priority 4 - Accessibility & Performance**
- [ ] Screen reader navigation works
- [ ] Keyboard navigation works
- [ ] Page load under 2s on 3G
- [ ] 60fps scrolling on long lists

---

## Bug Tracking Template

When you find a bug, document it with:

```
**Bug**: [Short description]
**Page**: /member/[page]
**Severity**: Critical / High / Medium / Low
**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected**: [What should happen]
**Actual**: [What actually happens]
**Screenshot**: [Attach screenshot if visual bug]
**Browser/Device**: [e.g., Chrome 118 / iPhone 14 Pro]
```

---

## Sign-Off Criteria for Phase D

Phase D is complete when:
- [ ] All Priority 1 tests pass
- [ ] API contract tests pass (automated)
- [ ] Visual regression tests pass (automated)
- [ ] At least 80% of Priority 2 scenarios tested manually
- [ ] All critical bugs fixed
- [ ] Evidence collected (screenshots, API logs, test results)
- [ ] Ready for Phase E (production proof)
