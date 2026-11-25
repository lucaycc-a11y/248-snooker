# iOS Admin API

Endpoints the iOS app uses to check admin status and read admin data. All are
`GET`, never cached (`Cache-Control: no-store`), and live under `/api/admin/app/`.

## Auth

Sign in with Supabase Auth in the app, then send the access token on every call:

```
Authorization: Bearer <supabase_access_token>
```

The server verifies the token with Supabase, then looks the user up in
`admin_users` (`invite_status = 'active'`). Without a Bearer header the cookie
session is used instead (handy for testing from the web admin).

| Result | Meaning |
|---|---|
| `401` | Missing, invalid or expired token — refresh the session and retry once |
| `403` | Valid user, but not an admin (admin-only routes) |

## `GET /api/admin/app/me`

Is the signed-in user an admin? Call it after login to decide whether to show admin features.

```json
{ "isAdmin": true, "role": "super_admin", "userId": "…", "email": "…", "displayName": "…" }
```

A valid non-admin gets `200 { "isAdmin": false }` (not 403), so the app can hide admin UI without treating it as an error.

## `GET /api/admin/app/overview`

Admin home. Optional `?includeTest=true` counts test bookings too.

```json
{
  "date": "2026-11-25", "nowTime": "10:05",
  "stats": { "total": 6, "live": 1, "upcoming": 3, "unpaid": 0 },
  "tableCount": 2,
  "bookings": [ { "id": "…", "humanCode": "…", "tableNumber": 1, "startTime": "14:00", "endTime": "16:00", "status": "confirmed", "userName": "…", "userPhone": "…" } ],
  "week": [],
  "revenue": { "today": { "revenue": 4800, "bookingCount": 6, "averagePerBooking": 800, "refund": 0, "promoDiscount": 0, "pointsDiscount": 0, "creditDiscount": 0, "net": 4800 }, "month": { "…same fields…": 0 }, "monthFrom": "2026-11-01" },
  "door": { "device_id": "main_door", "last_seen": "…", "status": "online" },
  "version": { "version": "8.0.55", "label": "v8.0.55", "isTest": false },
  "error": null
}
```

All dates and times are Hong Kong wall-clock. `revenue` is the web 收入 figures for today and the month to date (confirmed bookings, hidden and test accounts excluded) — show it as is; **never add bookings up in the app**. It is `null` when it could not be loaded (not a real zero). A non-null `error` with an empty
`bookings` means the read failed, not that there are no bookings.

## `GET /api/admin/app/bookings`

`?date=YYYY-MM-DD` or `?from=&to=` (default: today, HK). Optional `status`, `includeTest=true`, `limit` (max 300).
Paging: `limit` (max 300) and `offset`; the response also has `total` and `nextOffset` (`null` on the last page) — keep requesting until `nextOffset` is `null`. Returns `{ from, to, total, nextOffset, bookings: [{ id, humanCode, date, startTime, endTime, durationHours, tableNumber, status, totalPrice, paymentMethod, isTest, userName, userPhone, userEmail, createdAt }] }`.

## `GET /api/admin/app/bookings/:id`

`:id` is the uuid or the human code. Same fields as above plus `memberCode`, `adminNote`, `cancellationReason`, `promoCode`, `discounts { promo, credit, points }`, `refundAmount`, `refundedAt`, `confirmationEmailSentAt`. `404` if not found.

## `GET /api/admin/app/revenue`

`?from=&to=` (default: this month), optional `paymentMethod` (`card`, `alipay`, `credit`, `cash`, …), `includeTest`, `detailPage` (50 rows a page). Same loader as the web 收入 screen. Money is HKD; `revenue` = Σ `total_price` of **confirmed** bookings, `net` = `revenue − refund`.

```json
{
  "range": { "from": "2026-11-01", "to": "2026-11-25" },
  "totals": { "revenue": 48200, "bookingCount": 61, "averagePerBooking": 790, "refund": 600, "promoDiscount": 1200, "pointsDiscount": 300, "creditDiscount": 0, "net": 47600 },
  "daily": [ { "date": "2026-11-25", "revenue": 4800, "count": 6, "refund": 0 } ],
  "byMethod": [ { "key": "card", "label": "信用卡", "revenue": 30000, "count": 40 } ],
  "byTable": [ { "key": "1", "label": "…", "revenue": 24000, "count": 30 } ],
  "byPeriod": [ { "key": "evening", "label": "晚上", "revenue": 20000, "count": 25 } ],
  "promos": [ { "code": "WELCOME", "uses": 3, "totalDiscount": 300 } ],
  "detail": [ { "id": "…", "humanCode": "…", "date": "2026-11-25", "startTime": "14:00", "tableNumber": 1, "memberName": "…", "memberPhone": "…", "memberCode": "…", "status": "confirmed", "paymentMethod": "card", "amount": 800, "promoCode": null, "promoDiscount": 0 } ],
  "detailTotal": 61, "detailPage": 1, "detailPageSize": 50,
  "reconciliation": { "attemptsInRange": 70, "linkedToBooking": 68, "orphaned": 2, "note": "…" }
}
```

On failure the status is `500` with `{ "error": "…" }` — never an empty success. Use `totals` for headline numbers; `daily` for charts.

## `GET /api/admin/app/members`

`?search=&page=1&includeHidden=true` — same loader as the web 會員 screen (500 per page, hidden accounts excluded by default). Returns `{ members: [{ id, memberCode, email, displayName, phone, tier, points, credits, needsManualPhoneReverify, isPhoneVerified, totalSpend, bookingCount, lastActiveAt, isBlacklisted, isHidden, createdAt }], total, page, pageSize, error }`.

## `GET /api/admin/app/members/:id`

Read-only member detail, same data as the web member page: `{ member: { id, memberCode, email, displayName, phone, tier, points, isBlacklisted, isHidden, hiddenReason, createdAt }, bookings: [{ id, humanCode, date, status, totalPrice, tableNumber }] (last 50 real bookings), pointsLedger: [{ id, points, type, note, createdAt }] (last 50), activity: [{ action, before, after, createdAt }] (last 20 audit rows), riskStats: { totalBookings, cancelledBookings, waivedFees } }`. Editing points, credit, tier or blacklist is not in the app API yet.

## `GET /api/admin/app/follow-ups?days=14`

Same loader as the web 跟進名單: `{ unpaid: [{ userId, displayName, phone, email, memberCode, attempts: [{ bookingId, humanCode, status, date, startTime, tableNumber, price, createdAt, paymentMethod, promoCode }], lastAttemptAt, paidLater, confirmedCount }], noBooking: [{ userId, displayName, phone, email, memberCode, createdAt, daysSinceSignup, hasUnpaidAttempt, phoneVerified }], unpaidDays }`. Hidden accounts are excluded.

## 封枱 `/api/admin/app/maintenance`

Same logic and audit trail as the web 封枱 page.

- `GET ?date=YYYY-MM-DD` (optional) → `{ blocks: [{ id, date, start_time, end_time, table_number, reason, created_by }] }`.
- `POST { date, table_number?, start_time?, end_time?, reason? }` — `table_number: null` blocks all tables; `start_time` and `end_time` must be sent together (omit both for the whole day). Customers cannot book blocked slots, so ask the admin to confirm first.
- `DELETE /api/admin/app/maintenance/:id` — removes a block.

## `GET /api/admin/app/search?q=`

Bookings and members (max 10 each, `q` ≥ 2 chars): `{ bookings: [...], members: [{ id, displayName, email, phone, memberCode, tier }] }`.

## Hidden accounts (same data and rules as web 系統 → 隱藏帳戶)

- `GET /api/admin/app/hidden-users` — any admin: `{ success, hidden: [{ userId, email, displayName, memberCode, reason, createdAt }] }`.
- `POST /api/admin/app/hidden-users` — **super_admin only** (403 otherwise), audited like the web:
  `{ "action": "add", "userId": "<uuid>", "reason": "內部測試帳戶" }`, `{ "action": "remove", "userId": "<uuid>", "reason": "…" }`, `{ "action": "add_all_admins", "reason": "…" }`. `reason` must be at least 5 characters. Errors: `400` bad input, `404` not found, `409` already hidden.
- Find the `userId` with `GET /api/admin/app/search?q=` (members carry `hidden: true|false`).

Hidden and test accounts are left out of `bookings`, `search` (bookings), `revenue` and push alerts, exactly as on the web. `bookings?includeTest=true` shows them.

## Push notifications (new booking alerts)

Every confirmed booking creates a feed event and an APNs push to every active admin's registered devices (test and hidden-account bookings are skipped; each booking is announced once).

- `POST /api/admin/app/devices` — register or refresh a device. Body: `{ "token": "<hex APNs token>", "environment": "production" | "sandbox", "locale": "zh-HK", "appVersion": "1.0.0", "enabled": true, "prefs": { "booking_new": true } }`. Call on every launch. `environment` is `sandbox` for Xcode debug builds, `production` for TestFlight/App Store.
- `DELETE /api/admin/app/devices` — body `{ "token": "…" }`; call on sign-out.
- `GET /api/admin/app/feed?limit=30&before=<ISO>` — `{ items: [{ id, kind, title, body, data, createdAt, unread }], unreadCount, nextBefore }`. Use `unreadCount` for the app badge.
- `POST /api/admin/app/feed/read` — marks the feed read for this admin.

Push payload: `aps.alert { title, body }` plus custom keys `kind` (`booking_new`), `bookingId`, `humanCode`. Open `GET /api/admin/app/bookings/:bookingId` when the user taps it.

Device tokens are read from both `app_push_devices` (this API) and the app's existing `admin_device_tokens` table; the same token in both gets one push, so the app works without changes.

**Do not run two senders.** The old database trigger `notify-on-booking-created` (edge function `send-booking-notification`) also sends a push on every confirmation. Switch over in this order: set the `APNS_*` variables in Vercel, then disable that trigger. Until then, one booking can notify twice.

Server env (Vercel): `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8` (the .p8 contents), `APNS_BUNDLE_ID`. Without them pushes are skipped but the feed still works. Tokens APNs reports as invalid are deleted automatically.

## Existing admin endpoints that also accept a Bearer token

- `GET /api/admin/door-status` — door heartbeat, relays, recent access logs, lockouts.
- `POST /api/door/admin-override` — body `{ "action": "open_door", "device_id": "main_door", "scope": "main_door", "tables": [] }`; opens the door for 5 seconds and writes an access-log row.

## Adding a new app endpoint

1. Put it in `app/api/admin/app/<name>/route.ts`.
2. Start with `authenticateAppRequest(req)` from `lib/admin/bearer-auth.ts`; return 401 for `unauthenticated` and 403 for anything other than `admin`.
3. Read data through the existing `lib/data/*` loaders; never expose the service-role key or return raw rows.
4. Add it to this file.
