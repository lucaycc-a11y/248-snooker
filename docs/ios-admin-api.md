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
  "door": { "device_id": "main_door", "last_seen": "…", "status": "online" },
  "version": { "version": "8.0.55", "label": "v8.0.55", "isTest": false },
  "error": null
}
```

All dates and times are Hong Kong wall-clock. A non-null `error` with an empty
`bookings` means the read failed, not that there are no bookings.

## Existing admin endpoints that also accept a Bearer token

- `GET /api/admin/door-status` — door heartbeat, relays, recent access logs, lockouts.

## Adding a new app endpoint

1. Put it in `app/api/admin/app/<name>/route.ts`.
2. Start with `authenticateAppRequest(req)` from `lib/admin/bearer-auth.ts`; return 401 for `unauthenticated` and 403 for anything other than `admin`.
3. Read data through the existing `lib/data/*` loaders; never expose the service-role key or return raw rows.
4. Add it to this file.
