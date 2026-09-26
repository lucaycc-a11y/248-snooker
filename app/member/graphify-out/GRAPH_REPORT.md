# Graph Report - app/member  (2026-09-25)

## Corpus Check
- 29 files · ~20,737 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 161 nodes · 177 edges · 23 communities (12 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0445da1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MemberDashboard.tsx
- MemberPageClient.tsx
- manage/page.tsx
- BookingHistory.tsx
- help/page.tsx
- points/page.tsx
- ActionGrid.tsx
- MemberCardFlip.tsx
- PointsHistory.tsx
- inbox/page.tsx
- NotificationSettings.tsx
- BottomLinks.tsx
- PastBookingsList.tsx
- UpcomingBookingCard.tsx
- legal/page.tsx
- MemberCard.tsx
- safety/page.tsx
- settings/page.tsx
- [id]/page.tsx
- SecuritySettings.tsx
- TierRing.tsx

## God Nodes (most connected - your core abstractions)
1. `extractTime()` - 6 edges
2. `BookingSection()` - 6 edges
3. `PointsPage()` - 6 edges
4. `formatDate()` - 5 edges
5. `MemberCardFlip()` - 5 edges
6. `formatTimeDisplay()` - 4 edges
7. `bookingStart()` - 4 edges
8. `MemberDashboard()` - 3 edges
9. `bookingEnd()` - 3 edges
10. `canShowQr()` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (23 total, 11 thin omitted)

### Community 0 - "MemberDashboard.tsx"
Cohesion: 0.08
Nodes (21): bookingEnd(), BookingSection(), bookingStart(), calendarLink(), canRefund(), canReschedule(), canShowQr(), EASE (+13 more)

### Community 1 - "MemberPageClient.tsx"
Cohesion: 0.16
Nodes (10): ActionTileProps, checkIsAdmin(), HorizontalActionTiles(), Props, MemberAuthGuard(), BottomLinks, MemberPageClient(), PastBookingsList (+2 more)

### Community 2 - "manage/page.tsx"
Cohesion: 0.15
Nodes (8): Tab, TabButtonProps, PersonalInfoTab(), Props, PrivacyDataTab(), Identity, ProviderRowProps, SecurityTab()

### Community 3 - "BookingHistory.tsx"
Cohesion: 0.29
Nodes (4): BookingCard(), BookingCardProps, getStatusColor(), Props

### Community 4 - "help/page.tsx"
Cohesion: 0.25
Nodes (4): FAQAccordionProps, FAQItem, HelpLinkProps, REFUND_FAQ

### Community 5 - "points/page.tsx"
Cohesion: 0.43
Nodes (7): getTierBackgroundGradient(), getTierGradient(), getTierIcon(), getTierName(), getTierRingColor(), MemberProfile, PointsPage()

### Community 6 - "ActionGrid.tsx"
Cohesion: 0.40
Nodes (4): ActionCardProps, ActionGrid(), checkIsAdmin(), Props

### Community 7 - "MemberCardFlip.tsx"
Cohesion: 0.53
Nodes (5): getTierBackgroundGradient(), getTierIconComponent(), getTierRingColorPair(), MemberCardFlip(), Props

### Community 8 - "PointsHistory.tsx"
Cohesion: 0.47
Nodes (4): getCategoryColor(), getCategoryIcon(), Props, TransactionRow()

### Community 15 - "MemberCard.tsx"
Cohesion: 0.67
Nodes (3): getTierRingColorPair(), MemberCard(), Props

## Knowledge Gaps
- **45 isolated node(s):** `Props`, `BookingCardProps`, `Props`, `SPRING`, `EASE` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `MemberCardFlip()` connect `MemberCardFlip.tsx` to `MemberPageClient.tsx`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `Props`, `BookingCardProps`, `Props` to the rest of the system?**
  _45 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MemberDashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08253968253968254 - nodes in this community are weakly interconnected._