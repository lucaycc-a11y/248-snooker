# Stage 3 — WS-B Brief: Checkout & Space Wallet Integration

**Owner:** Checkout page, wallet apply/remove UI, checkout API routes, payment confirmation.

**Files owned:**
- Checkout order summary (components/checkout/OrderSummary.tsx)
- Checkout API routes (app/api/checkout/*)
- Payment flow (Stripe confirmation, free booking confirmation)

**Shared dependencies:**
- lib/pricing/ (Stage 2)
- lib/copy/points-credit.ts (Stage 2)
- lib/wallet/server.ts (Stage 2)
- prepare_checkout() database function (exists, do not reimplement)

---

## Tasks

1. **Add Space Wallet row** below promo code in order summary (same visual style, 44px tap targets)
   - Shows when balance > 0: "Space Wallet 可用餘額：HK$X" + "套用" button
   - "Available" = balance minus reserved amounts (server returns exact figure)

2. **Mutually exclusive UI:** wallet + promo toggle (disable one while other is active)

3. **Apply button** calls server route: `POST /api/checkout/wallet/apply` → calls `prepare_checkout(bookingId, userId, p_credits=available)`
   - Returns: `{ subtotal, walletDiscount, total, canApplyPoints }`

4. **Remove link** calls: `POST /api/checkout/wallet/remove` → calls `prepare_checkout(bookingId, userId, p_credits=0)`

5. **Summary updates:** `小計`, `Space Wallet 折抵` (or promo), `可賺積分` (from net total), `總計`

6. **Zero-total orders:** wallet covers everything → no payment form, button reads "確認預約", use free booking path

7. **Security (critical):**
   - User ID from session, never from request body
   - No amounts sent by client (only "apply" or "remove")
   - POST only, rate-limit 20/min
   - No wallet balance in error responses

8. **Error mapping:** every `prepare_checkout` failure reason → user-facing copy from copy deck

## Acceptance

- Wallet box appears, promo + wallet exclusive ✅
- Apply/remove calls correct server routes ✅
- Summary updates correctly ✅
- Zero-total order works (no payment form, booking confirmed) ✅
- Balance reserved correctly (can be picked up by another checkout) ✅
- Security checks pass (no user ID in request body, no balance in response) ✅
- npm run build + tsc pass ✅
