# Stage 3 — WS-C Brief: Space Wallet & SPACE PTS Pages

**Owner:** Member wallet and points pages, tiles, display logic.

**Files owned:**
- Member page (app/member/page.tsx) — tiles layout
- Space Wallet page (app/[locale]/member/wallet/page.tsx) — new
- SPACE PTS page (app/[locale]/member/points/page.tsx) — new
- Wallet tile component
- Points tile component

**Shared dependencies:**
- lib/wallet/server.ts (Stage 2)
- lib/copy/points-credit.ts (Stage 2)
- lib/inbox/client.ts (Realtime hook)

---

## Tasks

1. **Space Wallet tile:** replace greyed-out "即將推出 BETA" with live balance chip (HK$X)

2. **Space Wallet page:**
   - Large header: "Space Wallet 餘額 HK$X"
   - Description: "1 元 = HK$1，可直接抵扣預約費用。"
   - Movement history from `credits_ledger` (newest first, paginated)
     - Columns: amount, type label (from copy deck), date, running balance_after
   - Empty state included
   - **NO coupon box, NO code input, NO "convert" button, NO top-up button**

3. **SPACE PTS page:**
   - Show: accumulated points (`points`), redeemable points (`points − points_converted`), converted points (`points_converted`)
   - Progress bar: "再累積 N 積分，自動存入 HK$10 至 Space Wallet" (N = 100 − redeemable)
   - Current tier badge (name only, no progress to next tier)
   - Points history from `points_ledger` (newest first, paginated)
     - Columns: points, type label (from copy deck), date
   - Collapsible "積分如何運作" explanation (rules from copy deck)
   - Empty state included

4. **Data refresh on Inbox update:**
   - Use `useInboxRealtime()` hook to detect when a wallet or points notice arrives
   - Trigger refetch of `getWalletSummary()` and ledgers so numbers update without manual reload

5. **Security:**
   - Wallet and points fetched with member's own session (RLS)
   - Never fetch for a user_id from URL or request
   - Member editing URL or query params still sees only their own data

## Acceptance

- Wallet tile shows balance ✅
- Wallet page: balance, description, ledger (newest first, paged), empty state ✅
- Points page: accum/redeem/converted, progress bar, ledger, explanation, tier badge ✅
- Numbers refresh live when Inbox notice arrives (no manual reload) ✅
- Security: RLS enforced, user ID from session only ✅
- npm run build + tsc pass ✅
