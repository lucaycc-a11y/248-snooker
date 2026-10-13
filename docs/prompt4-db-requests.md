# Prompt 4 Database Requests

Items that need database schema changes:

## Fix 4 — Admin features requiring database schema

### `users.last_active_at` column
- **Current state:** Code references `last_active_at` in admin queries, but column does not exist
- **Locations:** `lib/data/getAdminMembers.ts`, `app/admin/members/[id]/page.tsx`, `components/admin/widgets/ActiveUsersWidget.tsx`
- **Request:** Add `users.last_active_at timestamptz` column if this tracking is desired
- **Workaround applied:** Code now shows "—" for last active; widget shows "尚未啟用"

### `staff_nfc_cards` table
- **Current state:** Door admin queries a table that was never created
- **Locations:** `app/api/admin/door/cards/[id]/route.ts`, `app/api/admin/door/register-request/[id]/confirm/route.ts`, door admin page
- **Request:** Create `staff_nfc_cards` table if NFC door access is desired
- **Workaround applied:** Door features return 501 with clear error message

---

*Generated during Prompt 4 stabilization pass*
