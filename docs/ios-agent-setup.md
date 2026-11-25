# iOS app — agent setup tutorial

For an AI agent (or developer) building the Space8 admin iOS app against this backend.
Read `AGENT_SETUP.md` for the web repo rules and `docs/ios-admin-api.md` for the endpoint reference.

## 1. What you are building

An admin-only app: sign in, see today's bookings, get a push when a booking is made,
open booking details, check revenue, open the door. The backend is the existing Next.js
site; the app only talks to `https://space8.com.hk/api/admin/app/*`.

## 2. Backend facts you need

- Auth is Supabase Auth. Sign in in the app (Apple / Google / email), then send
  `Authorization: Bearer <access_token>` on every request. Project ref `wqmciwieiqvnswvspdyz`;
  get the project URL and publishable (anon) key from the owner — never use the service-role key in the app.
- Call `GET /api/admin/app/me` after sign-in: `401` = refresh session and retry once;
  `{ isAdmin: false }` = show "no access"; `{ isAdmin: true }` = continue.
- Times are Hong Kong wall-clock strings (`YYYY-MM-DD`, `HH:MM`). Do not convert time zones.
- Responses are never cached. Money values are HKD numbers.

## 3. Push notifications setup

Owner (Apple Developer account):
1. Enable the Push Notifications capability for the app's bundle ID.
2. Create an APNs Auth Key (.p8). Note the Key ID and Team ID.
3. Add to Vercel (Production and Preview): `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`,
   `APNS_KEY_P8` (paste the whole .p8 file; `\n` escapes are accepted).

App:
1. Request notification permission, call `registerForRemoteNotifications()`.
2. Convert the device token `Data` to a lowercase hex string.
3. `POST /api/admin/app/devices` with `{ token, environment, locale, appVersion }` on every launch.
   Use `environment: "sandbox"` for Xcode debug builds, `"production"` for TestFlight / App Store.
4. On sign-out, `DELETE /api/admin/app/devices` with the token.
5. On a tap, read `userInfo["bookingId"]` and open `GET /api/admin/app/bookings/:id`.
6. Set the app badge from `unreadCount` in `GET /api/admin/app/feed`; call `POST /api/admin/app/feed/read` when the inbox is opened.

## 4. Try it without the app

```bash
TOKEN=...   # a Supabase access token of an active admin
curl -s -H "Authorization: Bearer $TOKEN" https://space8.com.hk/api/admin/app/me
curl -s -H "Authorization: Bearer $TOKEN" "https://space8.com.hk/api/admin/app/bookings?date=2026-11-25"
curl -s -H "Authorization: Bearer $TOKEN" https://space8.com.hk/api/admin/app/feed
```

Never paste a real token or key into chat, issues or commits.

## 5. Adding another endpoint (backend work)

Follow "Adding a new app endpoint" in `docs/ios-admin-api.md`. Use `requireAppAdmin(req)` from
`lib/admin/app-guard.ts`, keep route files exporting only HTTP methods and `dynamic`
(shared helpers go in `lib/`), no `any`, and add a row to `app_versions` with every push.
Verify with the Vercel preview build — see `AGENT_SETUP.md` section 5.

## 6. Out of scope for now

Cancelling or refunding bookings, editing prices, and member editing stay in the web admin.
Do not add them to the app API without the owner's approval.
