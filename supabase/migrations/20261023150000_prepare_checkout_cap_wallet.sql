-- Wallet checkout: cap the requested credits at what the customer actually has.
-- /api/checkout/create sends walletAmount = booking total (e.g. 108). Before this
-- change prepare_checkout rejected with insufficient_credits whenever the total
-- exceeded the wallet balance (e.g. 100), so every wallet checkout below the
-- total failed. Now it uses min(requested, available, net) and only rejects when
-- nothing is available. `requested` in discount_snapshot still stores p_credits,
-- so the provider-order lock comparison is unchanged.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.prepare_checkout(uuid,uuid,text,integer,integer)'::regprocedure) into d;
  n := replace(d,
    E'IF p_credits > v_available_credits THEN\n        RETURN jsonb_build_object(''success'', false, ''reason'', ''insufficient_credits''',
    E'IF v_available_credits <= 0 THEN\n        RETURN jsonb_build_object(''success'', false, ''reason'', ''insufficient_credits''');
  n := replace(n,
    'v_credit_total := floor(least(p_credits::numeric, v_net))::integer;',
    'v_credit_total := floor(least(p_credits::numeric, v_available_credits::numeric, v_net))::integer;');
  if n = d or (length(n) - length(d)) <> (length('v_available_credits <= 0') - length('p_credits > v_available_credits')) + length(', v_available_credits::numeric') then
    raise exception 'prepare_checkout: expected text not found, nothing changed';
  end if;
  execute n;
end $$;
