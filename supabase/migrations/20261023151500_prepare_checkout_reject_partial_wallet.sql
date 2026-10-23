-- Follow-up to 20261023150000. Capping at the *available* balance meant that when
-- another unpaid order still held part of the wallet, checkout silently applied
-- only the remainder (UI showed HK$18, KPay was asked for HK$98). Now: if holds
-- leave less than min(requested, wallet balance, net) available, reject with
-- insufficient_credits so the route's supersede recovery releases the dead
-- order and retries; otherwise the full amount the UI shows is applied.
do $$
declare d text; n text;
begin
  select pg_get_functiondef('public.prepare_checkout(uuid,uuid,text,integer,integer)'::regprocedure) into d;
  n := replace(d,
    E'IF v_available_credits <= 0 THEN\n        RETURN jsonb_build_object(''success'', false, ''reason'', ''insufficient_credits''',
    E'IF v_available_credits <= 0 OR v_available_credits < least(p_credits::numeric, COALESCE(v_user_credits, 0)::numeric, floor(v_net)) THEN\n        RETURN jsonb_build_object(''success'', false, ''reason'', ''insufficient_credits''');
  if n = d then raise exception 'prepare_checkout: expected text not found, nothing changed'; end if;
  execute n;
end $$;
