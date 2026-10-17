-- Migration D: admin_dashboard_d_adjust_points_credit
-- Two small admin adjusters with the same guard block as admin_cancel_with_credit.
-- Points go through users.points + points_ledger('manual'); Credit goes through
-- wallet_apply('manual') only — never a direct users.credits write.
-- Inbox notices are sent by the calling route (notify_member), not here.
-- Source: 01-database-guideline.md (Luca). Wallet cap read live from config.

create or replace function public.admin_adjust_points(
  p_user_id uuid, p_delta integer, p_note text, p_admin_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text; v_balance integer; v_new integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select email into v_email from public.admin_users
   where user_id = p_admin_id and invite_status = 'active' and is_active is not false;
  if v_email is null then return jsonb_build_object('success', false, 'code', 'admin_not_active'); end if;
  if p_note is null or length(btrim(p_note)) < 5 then return jsonb_build_object('success', false, 'code', 'reason_required'); end if;
  if p_delta is null or p_delta = 0 then return jsonb_build_object('success', false, 'code', 'invalid_amount'); end if;

  select points into v_balance from public.users where id = p_user_id for update;
  if not found then return jsonb_build_object('success', false, 'code', 'user_not_found'); end if;

  v_new := coalesce(v_balance, 0) + p_delta;
  if v_new < 0 then return jsonb_build_object('success', false, 'code', 'below_zero'); end if;

  update public.users set points = v_new where id = p_user_id;

  insert into public.points_ledger (user_id, points, type, reference_id, note)
  values (p_user_id, p_delta, 'manual', null, btrim(p_note));

  insert into public.audit_log (admin_user_id, admin_email, action, target_table, target_id, before_value, after_value)
  values (p_admin_id, v_email, 'member_points_adjust', 'users', p_user_id::text,
          jsonb_build_object('points', coalesce(v_balance, 0)),
          jsonb_build_object('points', v_new, 'delta', p_delta, 'note', btrim(p_note)));

  return jsonb_build_object('success', true, 'user_id', p_user_id, 'delta', p_delta, 'balance', v_new);
end $$;

create or replace function public.admin_adjust_credit(
  p_user_id uuid, p_amount integer, p_note text, p_admin_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text; v_balance integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select email into v_email from public.admin_users
   where user_id = p_admin_id and invite_status = 'active' and is_active is not false;
  if v_email is null then return jsonb_build_object('success', false, 'code', 'admin_not_active'); end if;
  if p_note is null or length(btrim(p_note)) < 5 then return jsonb_build_object('success', false, 'code', 'reason_required'); end if;
  if p_amount is null or p_amount = 0 then return jsonb_build_object('success', false, 'code', 'invalid_amount'); end if;

  -- Single money path. Raises wallet_amount_out_of_range / wallet_insufficient_balance
  -- / wallet_user_not_found; the whole call then rolls back.
  v_balance := public.wallet_apply(p_user_id, p_amount, 'manual', null, btrim(p_note), p_admin_id);

  insert into public.audit_log (admin_user_id, admin_email, action, target_table, target_id, before_value, after_value)
  values (p_admin_id, v_email, 'member_credit_adjust', 'users', p_user_id::text,
          jsonb_build_object('credits', v_balance - p_amount),
          jsonb_build_object('credits', v_balance, 'delta', p_amount, 'note', btrim(p_note)));

  return jsonb_build_object('success', true, 'user_id', p_user_id, 'delta', p_amount, 'balance', v_balance);
end $$;

revoke all on function public.admin_adjust_points(uuid,integer,text,uuid) from public, anon, authenticated;
revoke all on function public.admin_adjust_credit(uuid,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_adjust_points(uuid,integer,text,uuid) to service_role;
grant execute on function public.admin_adjust_credit(uuid,integer,text,uuid) to service_role;
