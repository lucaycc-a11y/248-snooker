# PaymentX changelog

PaymentX is the KPay 全托管收銀台 (hosted cashier) payment system. It is separate from the
live KPay direct-connect flow (`lib/payments`, version line 4.x) and has its own version line.
Source of truth: `lib/paymentx/version.ts`.

## vX1.0.0 — 2026-10-29

First release. Admin-selected test accounts only.

- New independent payment system: KPay `/v1/managed/order/add` → signed redirect to the KPay
  cashier (`/v1/web/managed/order` desktop, `/v1/h5/managed/order` mobile) → customer picks the
  method on KPay's page.
- Test list: 後台 → 設定 → PaymentX. Only accounts on `paymentx_testers` see the checkout entry
  and can call `/api/paymentx/create`. Empty list = feature off. Everyone else is unaffected.
- One live managed order per booking (`paymentx_orders` unique partial index). Re-opening the
  cashier returns the same order with a fresh signed URL, so a customer cannot pay two orders.
  Amount change (wallet / promo) retires the old order and opens a new one.
- Result is taken from KPay's `/v1/managed/order/result`, never from the notify body. Notify
  (`/api/webhooks/paymentx`), the return-page poll and the admin “向 KPay 同步” button all call
  `settlePaymentXOrder`. Paid → confirm booking; slot gone / RPC refused / amount mismatch →
  `payment_review` (+ admin alert). Never refunds.
- Own tables: `paymentx_testers`, `paymentx_orders`, `paymentx_events` (raw notify payloads are
  visible in the admin panel). `bookings.payment_method` / `payment_provider` = `paymentx`;
  `provider_order_no` stays empty so the live KPay lookups never touch a managed order.
- `expire_stale_pending_bookings()` now also keeps a booking alive while its PaymentX order is
  pending (25 min), same as a direct KPay attempt.
- Return page `/book/paymentx` shows the real state (paid / waiting / needs review / not paid).

Known unknowns to verify with the first real test payments:
- The exact JSON of KPay's managed-order notify (stored in `paymentx_events`).
- The path KPay signs the notify with (verification tries this route's path and `/api/webhooks/kpay`).
- Whether `qrOrderExpireMinute` is accepted for this merchant.
