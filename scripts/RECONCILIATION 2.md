# Payment Reconciliation Guide

## Running the Reconciliation Script

The reconciliation script fixes bookings stuck in "pending" state despite Stripe showing payment as succeeded.

### Prerequisites

Ensure `.env.local` contains:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`

### Usage

**Reconcile a specific booking:**
```bash
npx tsx scripts/reconcile-stuck-bookings.ts dfb23454-f924-46f4-ac9a-bc754472958c
```

**Reconcile all stuck bookings:**
```bash
npx tsx scripts/reconcile-stuck-bookings.ts
```

### What it does

1. Queries the booking from the database
2. Retrieves the real PaymentIntent status from Stripe
3. Verifies the amount matches (charged vs. required)
4. If succeeded on Stripe but pending in DB:
   - Confirms the booking via the same RPC as the webhook
   - Sends confirmation email
   - Marks payment attempt complete
5. If amount mismatch detected:
   - **Underpaid**: moves to `payment_review` status (requires manual refund)
   - **Overpaid**: confirms booking but logs prominently for support follow-up

### Output

The script provides detailed console output showing:
- Booking details
- Stripe PaymentIntent status
- Amount verification
- Confirmation actions taken
- Email sending status

### Running in Production

For production reconciliation, run this on Vercel via a one-off deployment script or locally with production environment variables securely stored.

**Never commit production credentials to git.**
