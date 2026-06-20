---
name: Security & Backend
description: Use when writing API routes, database queries, auth logic, Stripe webhooks, QR codes, or any server-side code.
---

# Security & Backend Skill

## Supabase Rules
- EVERY new table: ENABLE ROW LEVEL SECURITY immediately
- EVERY table needs explicit policies for SELECT/INSERT/UPDATE/DELETE
- Never use service_role key on client side
- Use anon key only in NEXT_PUBLIC_ variables
- All DB changes via SQL Editor — MCP connects to wrong org
- Use createServerClient for Server Components, createBrowserClient for Client Components

```sql
-- Every new table starts with:
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own" ON public.new_table
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON public.new_table
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## API Route Template
```ts
export async function POST(req: Request) {
  try {
    // 1. Auth check
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Input validation
    const body = await req.json()
    if (!body.period || !body.duration) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // 3. Server-side price calculation (never trust client)
    const price = PRICES[body.period] * body.duration

    // 4. Business logic ...

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err) // never expose internals to client
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

## API Security
- Price ALWAYS calculated server-side only — never trust client
- Stripe webhook MUST verify signature:
  ```ts
  stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  ```
- Rate limiting on all auth routes (use rate_limits table)
- Input validation on all API routes
- Never log sensitive data (keys, tokens, PII)

## Auth Architecture
- Google OAuth via Supabase
- Apple Sign In via Supabase (Services ID: com.formhk.248.web)
- Phone/OTP path uses Twilio (lib/twilio)
- Session preserved across auth redirect via sessionStorage
- JWT signed with HMAC-SHA256 using JWT_SECRET env var
- Brute-force lockout: 5 failed attempts → 15min block

## QR Code Spec
- Code lives in lib/qr and app/api/qr/route.ts
- Format: JWT signed with QR_SECRET
- Human-readable: 248-[8char]-[4char]-[2digit Luhn checksum]
- Validate: device token + JWT signature + DB status (3 layers)
- Instant invalidation on refund via Supabase Realtime
- 5-min offline JWT fallback for ESP32 (door access via app/api/door)

## Environment Variables (never hardcode)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
JWT_SECRET
QR_SECRET
RESEND_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
NEXT_PUBLIC_SITE_URL
```

## Supabase Project
- Project ID: wqmciwieiqvnswvspdyz
- Dashboard: supabase.com/dashboard/project/wqmciwieiqvnswvspdyz
- SQL Editor for all schema changes
