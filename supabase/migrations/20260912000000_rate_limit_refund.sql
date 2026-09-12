-- Rate limit refund function
-- Decrements a rate-limit counter by 1 (floor 0) for the current window.
-- Used to refund an attempt that did not actually consume the resource it was
-- gating (e.g. OTP send that failed before dispatch due to reCAPTCHA race
-- condition, Engagelab API error, or internal reservation failure).

create or replace function public.refund_rate_limit(
  p_bucket text,
  p_identifier text,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  update public.rate_limits
     set count = greatest(count - 1, 0)
   where bucket = p_bucket
     and identifier = p_identifier
     and window_start = v_window_start;
end;
$$;

comment on function public.refund_rate_limit is
  'Decrements a rate-limit counter by 1 (floor 0) for the current window. Used to refund an attempt that did not actually consume the resource it was gating (e.g. OTP send that failed before dispatch).';

revoke all on function public.refund_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.refund_rate_limit(text, text, integer) to service_role;
