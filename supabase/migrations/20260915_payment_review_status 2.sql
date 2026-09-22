-- Amount-mismatch review state.
-- The Stripe webhook asserts paymentIntent.amount === total_price * 100 before
-- confirming. When they disagree the money is already taken, so the booking must
-- neither confirm (the customer would get a booking at a price they were not
-- charged) nor be marked payment_failed (the payment did succeed). It parks in
-- 'payment_review' for manual reconciliation: refund the difference, or refund in
-- full and re-charge.
--
-- Run in the Supabase SQL Editor for wqmciwieiqvnswvspdyz.

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN (
      'pending', 'confirmed', 'refunded', 'admin_cancelled',
      'payment_failed', 'cancelled', 'expired', 'payment_review'
    ));
END $$;

-- expire_stale_bookings must never sweep a row that has real money attached.
-- 'payment_review' is deliberately absent from its status filter, which only
-- covers ('pending', 'payment_failed').

COMMENT ON CONSTRAINT bookings_status_check ON public.bookings IS
  'payment_review = charge succeeded but amount disagreed with total_price; needs manual refund reconciliation.';
