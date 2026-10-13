# Stage 3 — WS-D Brief: Inbox

**Owner:** Inbox page, tile, unread badge, Realtime subscription.

**Files owned:**
- Inbox tile (member page)
- Inbox page (app/[locale]/member/inbox/page.tsx) — new
- Unread badge component

**Shared dependencies:**
- lib/inbox/server.ts (Stage 2)
- lib/inbox/client.ts (Stage 2) — Realtime hook

---

## Tasks

1. **Inbox page:**
   - List notifications newest first
   - Each row: title, message, relative time (e.g., "2 hours ago"), unread dot
   - Opening a row marks it read (`update admin_notifications set read = true`)
   - "全部標為已讀" action clears all unread
   - Empty state included

2. **Inbox tile on member page:**
   - Show unread count badge (cap display at 9+)
   - Link to Inbox page

3. **Realtime updates:**
   - Subscribe with `useInboxRealtime()` hook
   - New notice (e.g., "已使用 Space Wallet") appears live without reload
   - Unread badge updates immediately
   - Clean up subscription on unmount (one channel only)

4. **Notice types:**
   - Type `credit` notices link to Space Wallet page
   - Other types non-linking (display only)

5. **Security:**
   - Inbox fetched with member's own session (RLS)
   - Members cannot create notices (database does; app never creates)
   - Members can only write `read` column (update own notices)

## Acceptance

- Inbox page lists newest-first, marks read, shows unread dot ✅
- "全部標為已讀" works ✅
- Unread badge on tile, capped at 9+ ✅
- New notices appear live (Realtime) without reload ✅
- Credit notices link to Wallet; others non-linking ✅
- No notices created from app code ✅
- Security: RLS enforced, session-based user ID ✅
- Realtime cleanup on unmount ✅
- npm run build + tsc pass ✅
