# Admin: changing a member's phone or email

Members cannot change their own phone or email. Requests arrive on WhatsApp; an admin applies them.

## 1. Verify the customer (refuse if any check fails)

- **Preferred:** the request comes from the WhatsApp number already on the account.
- **Otherwise** the customer must give all three, and all must match the account:
  - booking reference (e.g. `SPACE8-XXXXX-C`)
  - name on the account
  - date of their last booking
- Never accept a screenshot, a "friend asking for them", or a request to send codes elsewhere.
- Ask *why*. Repeated changes or a request right after sign-up are signs of new-member-offer farming. Decline politely.

## 2. Make the change

Find the member's `user_id` in the admin app. Then, signed in to the admin app:

```js
await fetch('/api/admin/identity-change', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: '<member uuid>',
    new_phone: '+85291234567',   // OR new_email: 'name@example.com' — never both
    reason: 'WhatsApp from number on file; lost old SIM',
    // override: true,           // only to bypass the 90-day cooldown; logged
  }),
}).then(r => r.json())
```

Do **not** call `admin_change_user_identity()` from the SQL editor. It works, but no notice email is sent.

| Response `code` | Meaning |
|---|---|
| `in_use` | Another account has this phone/email. |
| `previously_used` | Identifier was used before (changed away from, or a deleted account). Cannot be reused. |
| `cooldown` | Changed in the last 90 days. Override only with a clear, documented reason. |
| `invalid_phone` / `invalid_email` / `unchanged` | Check the input. |

On success, check `email_ok: true`. If it is `false`, the change **did** happen but the notice failed (see `emails[].error` and `notification_log`). Tell the customer on WhatsApp yourself.

## 3. What the customer sees

- Signed out on all devices (within ≤1 hour for already-open tabs).
- A security email to the **old** address (and the new one, if the email changed) showing the masked old/new value and time, plus "如非本人操作，請立即聯絡客服".
- **Phone change:** the next SMS login sends a code to the new number, which re-verifies it.
- **Email change:** login with the new email works immediately. Google sign-in still works via the linked Google account.
- Member code, points, credits, coupons, bookings and entry QR are unchanged.

Every change is in `audit_log` (`member_change_phone` / `member_change_email`, masked values, reason) and `identity_change_history` (hashes only).
