# Door Lock System Implementation Summary

## Completed Components

### Database Schema
- **supabase/migrations/20260710_door_system_scoped_secrets.sql**
  - Added `scope` column to `door_secrets` (main_door/table_1/table_2)
  - Created `booking_tables` junction table for multi-table bookings
  - Created `door_room_relays` for GPIO mapping
  - Created `door_commands` for admin remote control
  - Created `door_lockouts` for keypad security
  - Added admin QR fields to `admin_users`
  - Configured RLS policies for all new tables

- **supabase/migrations/20260710_door_system_admin_qr_function.sql**
  - Created `generate_admin_qr()` RPC function
  - Generates 24-hour admin QR codes with SPACE8-ADMIN-* format

### API Routes (8 endpoints)

1. **app/api/door/validate-qr/route.ts**
   - Validates booking/member/admin QR codes
   - Returns which tables to unlock
   - Three priority levels: admin → booking → member

2. **app/api/door/validate-nfc/route.ts**
   - Validates admin NFC cards
   - Updates `last_used_at` timestamp
   - Logs all access attempts

3. **app/api/door/validate-password/route.ts**
   - Validates 6-digit TOTP passwords (0-9)
   - Scoped validation (main_door/table_1/table_2)
   - 3-attempt lockout with 15-minute timeout
   - Accepts current + previous time window

4. **app/api/door/backup-password/route.ts**
   - Generates current TOTP password for display
   - Scoped by device_id + scope
   - Returns valid_until timestamp

5. **app/api/door/active-bookings-cache/route.ts**
   - Returns all currently active bookings with table assignments
   - ESP32 offline fallback cache
   - Checks time window: [start_time - 5min, end_time]

6. **app/api/door/poll-commands/route.ts**
   - ESP32 heartbeat endpoint (updates device_heartbeat)
   - Returns pending admin commands (open_door, secret_rotated)
   - Marks commands as executed after retrieval

7. **app/api/door/admin-override/route.ts**
   - Admin-authenticated manual door open
   - Secret key rotation with scope support
   - Inserts commands into door_commands queue

8. **app/api/admin/generate-qr/route.ts**
   - Calls `generate_admin_qr()` RPC function
   - Returns QR code + expiry timestamp
   - Admin authentication required

9. **app/api/admin/door-status/route.ts**
   - Admin dashboard data endpoint
   - Returns device status, relays, access logs, lockouts
   - Refreshes every 10 seconds

### Admin Dashboard
- **app/admin/door-lock/page.tsx**
  - Real-time device status monitor
  - Quick action buttons (open main/table1/table2)
  - TOTP password viewer with refresh + rotate
  - Admin QR generator (24-hour expiry)
  - Lockout alerts display
  - Recent access logs (last 50 entries)
  - Auto-refresh every 10 seconds

### Documentation
- **docs/door-lock-esp32-integration.md**
  - Complete ESP32 firmware integration guide
  - API endpoint specifications with request/response examples
  - Relay GPIO mapping table
  - Offline fallback workflow
  - Security notes and testing checklist
  - Manual database setup SQL

## Architecture Features

### Scoped TOTP System
- 3 independent secrets per device (main_door, table_1, table_2)
- 6-digit passwords using 0-9 (changed from 8-digit 1-6)
- Hourly rotation (time_window = floor(timestamp / 3600))
- HMAC-SHA256 generation

### Multi-Table Booking Support
- One booking can reserve multiple tables via `booking_tables` junction
- QR validation returns `tables: [1, 2]` array
- ESP32 triggers corresponding relays based on tables array

### Relay Triggering Logic
- Main door (GPIO 27) **always** opens
- Room relays (GPIO 25/26) open conditionally based on:
  - Admin QR/NFC: main door only
  - Booking QR: main + booked tables
  - Keypad: main + scope-specific table

### Security Layers
1. Device API key authentication (DOOR_API_KEY)
2. Row Level Security policies on all tables
3. Admin-only access for sensitive operations
4. Keypad lockout after 3 failed attempts (15min)
5. Admin QR 24-hour expiry
6. Access logging for all methods

### Offline Resilience
- ESP32 caches active bookings every 60 seconds
- Booking QR codes work offline via local cache
- Keypad passwords fail gracefully (require server validation)
- Heartbeat updates switch device status online/offline

## Pending Manual Steps

1. **Run Database Migrations**
   ```bash
   # Apply both migration files in Supabase SQL Editor
   ```

2. **Set Environment Variable in Vercel**
   ```bash
   DOOR_API_KEY=<generate with: openssl rand -base64 32>
   ```

3. **Initialize Device Records** (SQL)
   ```sql
   INSERT INTO door_secrets (device_id, scope, secret_key)
   VALUES
     ('main_door', 'main_door', encode(gen_random_bytes(32), 'base64')),
     ('main_door', 'table_1', encode(gen_random_bytes(32), 'base64')),
     ('main_door', 'table_2', encode(gen_random_bytes(32), 'base64'));

   INSERT INTO device_heartbeat (device_id, status, last_seen)
   VALUES ('main_door', 'offline', now());
   ```

4. **ESP32 Firmware Implementation**
   - Follow docs/door-lock-esp32-integration.md
   - Implement WiFi connection + polling loop
   - Wire relay GPIOs (27, 25, 26)
   - Add QR scanner + NFC reader + keypad

5. **Admin NFC Card Registration**
   - Navigate to /admin/door-lock
   - Add staff NFC cards via UI (future feature)
   - Or manually insert into `staff_nfc_cards` table

## Next Steps (Optional Enhancements)

- [ ] NFC card management UI in admin dashboard
- [ ] Real-time WebSocket notifications for access events
- [ ] Access log filtering/search by method/result/date
- [ ] Device health alerts (offline > 5 minutes)
- [ ] Booking-level door access history
- [ ] ESP32 firmware OTA update system
- [ ] Multi-device support (expand beyond 'main_door')
- [ ] Relay scheduling (auto-lock after business hours)

## Testing the System

Once environment variables and migrations are complete:

1. Generate admin QR via `/admin/door-lock`
2. Test QR validation via Postman:
   ```bash
   curl -X POST https://248.formhk.com/api/door/validate-qr \
     -H "Content-Type: application/json" \
     -d '{"api_key":"xxx","device_id":"main_door","code":"SPACE8-ADMIN-xxx"}'
   ```
3. Test TOTP password generation:
   ```bash
   curl -X POST https://248.formhk.com/api/door/backup-password \
     -H "Content-Type: application/json" \
     -d '{"api_key":"xxx","device_id":"main_door","scope":"main_door"}'
   ```
4. Verify admin dashboard loads at `/admin/door-lock`
5. Check device status updates after running poll-commands

---

**Implementation Status:** ✅ Complete (Backend API + Admin UI + Documentation)  
**Deployment Ready:** Pending environment variables + database migrations  
**ESP32 Integration:** Documentation provided, firmware implementation required
