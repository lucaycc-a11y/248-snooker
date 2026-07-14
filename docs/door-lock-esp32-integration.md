# 248 Door Lock System — ESP32 Integration Guide

## Overview
This guide describes how to integrate the ESP32 firmware with the 248 Door Lock API backend for Space8's multi-table door control system.

## Architecture

```
ESP32 Device
  ├── Main Door Relay (always triggered)
  ├── Table 1 Relay (GPIO 25, triggered when booking includes table 1)
  └── Table 2 Relay (GPIO 26, triggered when booking includes table 2)

API Backend
  ├── QR/NFC Validation (validate-qr, validate-nfc)
  ├── Keypad TOTP Password (validate-password)
  ├── Active Bookings Cache (active-bookings-cache)
  └── Admin Remote Commands (poll-commands, admin-override)
```

## Authentication

All API requests require the `DOOR_API_KEY` header:

```cpp
const char* DOOR_API_KEY = "your-secret-key-here";

// Include in all requests
httpClient.addHeader("Content-Type", "application/json");
// api_key goes in request body, not header
```

## Core Workflows

### 1. Heartbeat + Command Polling

ESP32 should poll `/api/door/poll-commands` every 5-10 seconds to:
- Update online status (device_heartbeat table)
- Check for pending admin commands (open_door, secret_rotated)

**Request:**
```json
POST /api/door/poll-commands
{
  "api_key": "xxx",
  "device_id": "main_door"
}
```

**Response:**
```json
{
  "success": true,
  "command": {
    "action": "open_door",
    "scope": "main_door",
    "tables": [1],
    "duration_ms": 5000
  }
}
// or { "success": true, "command": null } if no pending commands
```

**ESP32 Action:**
- If `command.action === "open_door"`, trigger main door relay + room relays based on `tables` array
- If `command.action === "secret_rotated"`, clear cached TOTP passwords for that scope

---

### 2. QR Code Scan

When ESP32 scans a QR code, call `/api/door/validate-qr`:

**Request:**
```json
POST /api/door/validate-qr
{
  "api_key": "xxx",
  "device_id": "main_door",
  "code": "SPACE8-XXXXXX" // or "SPACE8-ADMIN-xxx" or member code
}
```

**Response (Booking QR):**
```json
{
  "success": true,
  "type": "booking",
  "tables": [1, 2],
  "start_time": "2026-07-10T14:00:00Z",
  "end_time": "2026-07-10T16:00:00Z"
}
```

**Response (Admin QR):**
```json
{
  "success": true,
  "type": "admin",
  "tables": []
}
```

**Response (Member QR):**
```json
{
  "success": true,
  "type": "member",
  "tier": "century",
  "has_active_booking": true,
  "tables": [1]
}
```

**ESP32 Action:**
- Always open main door relay
- Open room relays based on `tables` array (1 = GPIO 25, 2 = GPIO 26)
- Admin QR: main door only, no room relays
- Keep door open for 5 seconds, then close

---

### 3. NFC Card Tap

When ESP32 reads an NFC card UID, call `/api/door/validate-nfc`:

**Request:**
```json
POST /api/door/validate-nfc
{
  "api_key": "xxx",
  "device_id": "main_door",
  "uid": "04:A1:B2:C3:D4:E5:F6"
}
```

**Response:**
```json
{
  "success": true,
  "type": "admin_override",
  "label": "Manager Card",
  "tables": []
}
```

**ESP32 Action:**
- If `success: true`, open main door only (admin NFC cards don't trigger room relays)
- If `success: false`, deny access (show red LED, beep)

---

### 4. Keypad Password Entry

When user enters 6-digit password on keypad, call `/api/door/validate-password`:

**Request:**
```json
POST /api/door/validate-password
{
  "api_key": "xxx",
  "device_id": "main_door",
  "password": "123456",
  "scope": "main_door" // or "table_1", "table_2"
}
```

**Response (Success):**
```json
{
  "success": true,
  "scope": "main_door"
}
```

**Response (Lockout):**
```json
{
  "success": false,
  "reason": "locked_out",
  "locked_until": "2026-07-10T15:30:00Z"
}
```

**Response (Invalid):**
```json
{
  "success": false,
  "reason": "invalid_password",
  "attempts_left": 2
}
```

**ESP32 Action:**
- If `success: true`:
  - Open main door + corresponding room relay based on `scope`
  - `scope: "main_door"` → main relay only
  - `scope: "table_1"` → main relay + GPIO 25
  - `scope: "table_2"` → main relay + GPIO 26
- If `reason: "locked_out"`:
  - Show lockout countdown timer
  - Disable keypad until `locked_until` expires
- If `reason: "invalid_password"`:
  - Show error, display `attempts_left`

---

### 5. Offline Fallback

Every 60 seconds, ESP32 should sync `/api/door/active-bookings-cache` to local storage:

**Request:**
```json
POST /api/door/active-bookings-cache
{
  "api_key": "xxx",
  "device_id": "main_door"
}
```

**Response:**
```json
{
  "success": true,
  "active_bookings": [
    {
      "booking_id": "uuid",
      "tables": [1],
      "start_time": "2026-07-10T14:00:00Z",
      "end_time": "2026-07-10T16:00:00Z"
    }
  ],
  "cached_at": "2026-07-10T14:30:00Z"
}
```

**ESP32 Offline Logic:**
- When WiFi disconnects, switch to offline mode
- When QR code is scanned:
  - Extract `booking_id` from QR code format
  - Search local cache for matching `booking_id`
  - Check if current time is within `[start_time - 5min, end_time]`
  - If valid, open door + room relays based on `tables` array
- Keypad passwords cannot work offline (require TOTP calculation)

---

### 6. TOTP Password Generation (For Testing/Display)

Admin can view current TOTP passwords via `/api/door/backup-password`:

**Request:**
```json
POST /api/door/backup-password
{
  "api_key": "xxx",
  "device_id": "main_door",
  "scope": "main_door" // or "table_1", "table_2"
}
```

**Response:**
```json
{
  "success": true,
  "password": "482719",
  "scope": "main_door",
  "time_window": 123456,
  "valid_until": 1720627200000
}
```

**Note:** Passwords rotate every hour. ESP32 does NOT need to call this endpoint — passwords are validated server-side.

---

## Relay GPIO Mapping

| Scope       | Table Number | GPIO Pin | Label   |
|-------------|--------------|----------|---------|
| main_door   | -            | 27       | Main Door |
| table_1     | 1            | 25       | 場A      |
| table_2     | 2            | 26       | 場B      |

**Triggering Logic:**
- **Admin QR / Admin NFC:** Main door only (GPIO 27)
- **Booking QR with `tables: [1]`:** Main door (GPIO 27) + Table 1 (GPIO 25)
- **Booking QR with `tables: [2]`:** Main door (GPIO 27) + Table 2 (GPIO 26)
- **Booking QR with `tables: [1, 2]`:** All three relays (GPIO 27, 25, 26)
- **Keypad `scope: "table_1"`:** Main door (GPIO 27) + Table 1 (GPIO 25)

---

## Error Handling

All API endpoints return `{ success: false, reason: "error_code" }` on failure:

| Error Code               | Meaning                              | ESP32 Action                  |
|--------------------------|--------------------------------------|-------------------------------|
| `invalid_api_key`        | DOOR_API_KEY mismatch                | Log error, alert admin        |
| `unauthorized_card`      | NFC card not registered/disabled     | Show red LED, beep 3x         |
| `not_in_time_window`     | Booking not active yet/expired       | Show "Too early/late" message |
| `locked_out`             | Keypad locked after 3 failed attempts| Show countdown timer          |
| `max_attempts_reached`   | Just triggered lockout               | Lock keypad for 15min         |
| `invalid_password`       | Wrong TOTP password                  | Show error, decrement counter |
| `server_error`           | Backend 500 error                    | Retry 3x, then log error      |

---

## Security Notes

1. **Never log full passwords** — use `password.substring(0, 2) + "****"` in logs
2. **Store DOOR_API_KEY in secure flash** — not in plaintext code
3. **Use HTTPS** for all API calls (ESP32 should validate SSL cert)
4. **Rate limiting:** Do not poll faster than 5 seconds (will trigger rate limit)
5. **Offline cache:** Clear cached bookings after 2 hours if WiFi still disconnected

---

## Testing Checklist

- [ ] Heartbeat polling every 10 seconds updates device status to "online"
- [ ] Admin QR opens main door only (no room relays)
- [ ] Booking QR with `tables: [1]` opens main + table 1 relay
- [ ] Booking QR with `tables: [1, 2]` opens all three relays
- [ ] NFC admin card opens main door
- [ ] Keypad password with `scope: "table_1"` opens main + table 1
- [ ] 3 failed keypad attempts triggers 15-minute lockout
- [ ] Offline mode: cached booking QR still works
- [ ] Offline mode: keypad fails gracefully (show "Offline" message)
- [ ] WiFi reconnect: device status changes from "offline" to "online"
- [ ] Admin remote "open door" command triggers relay within 10 seconds

---

## Environment Variables (Backend)

Add to Vercel project settings:

```
DOOR_API_KEY=your-random-256-bit-secret-here
```

Generate with:
```bash
openssl rand -base64 32
```

---

## Manual Database Setup

After running migrations, manually insert device record:

```sql
-- Insert main door device with initial secret
INSERT INTO door_secrets (device_id, scope, secret_key)
VALUES
  ('main_door', 'main_door', encode(gen_random_bytes(32), 'base64')),
  ('main_door', 'table_1', encode(gen_random_bytes(32), 'base64')),
  ('main_door', 'table_2', encode(gen_random_bytes(32), 'base64'));

-- Initialize device heartbeat
INSERT INTO device_heartbeat (device_id, status, last_seen)
VALUES ('main_door', 'offline', now());
```

---

## Support

For API issues, check:
- Vercel function logs: `vercel logs --follow`
- Supabase logs: Dashboard → Logs → API
- ESP32 serial output: `115200 baud`

Contact: [admin dashboard /admin/door-lock]
