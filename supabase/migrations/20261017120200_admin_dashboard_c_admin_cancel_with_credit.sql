-- Migration C: admin_dashboard_c_admin_cancel_with_credit
-- One function, one transaction: cancel a confirmed booking and grant Space Credit.
-- Replaces admin_waive_booking, which writes a status, a ledger type and a table
-- that do not exist. Verified column-by-column against live schema 2026-10-17.
-- Source: 01-database-guideline.md (Luca).
--
-- Ordering note: reverse_booking_points runs BEFORE wallet_apply. That function can
-- claw back credits converted from points (wallet_apply -v_claw), and it caps the
-- claw at free credits (least(greatest(0, credits - held), ...)), so it cannot drive
-- a balance negative or raise wallet_insufficient_balance. Compensation is then
-- added on top. If any step raises, the whole call rolls back.

create or replace function public.admin_cancel_with_credit(
  p_booking_id uuid, p_admin_id uuid, p_reason text, p_whatsapp_ref text,
  p_credit_amount integer, p_notice_title text, p_notice_message text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text; v_b public.bookings%rowtype; v_earned integer; v_balance integer; v_cap integer; v_end timestamptz;
begin
  if coalesce(auth.role(),'') <> 'service_role' and session_user <> 'postgres' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select email into v_email from public.admin_users
   where user_id = p_admin_id and invite_status = 'active' and is_active is not false;
  if v_email is null then return jsonb_build_object('success', false, 'code', 'admin_not_active'); end if;
  if p_reason is null or length(btrim(p_reason)) < 5 then return jsonb_build_object('success', false, 'code', 'reason_required'); end if;
  if p_whatsapp_ref is null or length(btrim(p_whatsapp_ref)) < 3 then return jsonb_build_object('success', false, 'code', 'whatsapp_ref_required'); end if;
  if p_credit_amount is null or p_credit_amount < 0 then return jsonb_build_object('success', false, 'code', 'invalid_amount'); end if;
  select coalesce((value->>'wallet_max_single_amount')::integer, 10000) into v_cap from public.config where key = 'points_system';
  if p_credit_amount > coalesce(v_cap, 10000) then return jsonb_build_object('success', false, 'code', 'amount_out_of_range'); end if;

  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found then return jsonb_build_object('success', false, 'code', 'booking_not_found'); end if;
  if v_b.status <> 'confirmed' then return jsonb_build_object('success', false, 'code', 'not_cancellable'); end if;
  v_end := ((v_b.date + v_b.start_time) + (v_b.duration_hours || ' hours')::interval) at time zone 'Asia/Hong_Kong';
  if v_end <= now() then return jsonb_build_object('success', false, 'code', 'already_ended'); end if;

  update public.bookings set status = 'admin_cancelled', cancellation_reason = btrim(p_reason), updated_at = now() where id = p_booking_id;
  update public.slots set status = 'available', locked_by = null, locked_until = null where id = v_b.slot_id;

  select coalesce(sum(points), 0)::integer into v_earned from public.points_ledger where reference_id = p_booking_id and type = 'booking';
  perform public.reverse_booking_points(v_b.user_id, v_earned, p_booking_id, '後台取消回收積分');

  if p_credit_amount > 0 then
    v_balance := public.wallet_apply(v_b.user_id, p_credit_amount, 'refund', p_booking_id,
                   left('惡劣天氣取消補償 ' || coalesce(v_b.human_code, ''), 200), p_admin_id);
  end if;

  insert into public.cancellation_log (booking_id, admin_id, reason, compensation_type, compensation_value)
  values (p_booking_id, p_admin_id, btrim(p_reason), case when p_credit_amount > 0 then 'credit' else 'none' end, p_credit_amount);

  insert into public.audit_log (admin_user_id, admin_email, action, target_table, target_id, before_value, after_value)
  values (p_admin_id, v_email, 'booking_cancel_with_credit', 'bookings', p_booking_id::text,
          jsonb_build_object('status', v_b.status),
          jsonb_build_object('status','admin_cancelled','reason',btrim(p_reason),'whatsapp_ref',btrim(p_whatsapp_ref),'credit',p_credit_amount,'points_reversed',v_earned));

  perform public.notify_member(v_b.user_id, p_notice_title, p_notice_message, case when p_credit_amount > 0 then 'credit' else 'system' end);

  return jsonb_build_object('success', true, 'booking_id', p_booking_id, 'user_id', v_b.user_id, 'credit', p_credit_amount, 'points_reversed', v_earned, 'balance', v_balance);
end $$;

revoke all on function public.admin_cancel_with_credit(uuid,uuid,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.admin_cancel_with_credit(uuid,uuid,text,text,integer,text,text) to service_role;
comment on function public.admin_waive_booking(uuid,uuid,text,text,numeric) is 'DEPRECATED 2026-10: writes a status, a ledger type and a table that do not exist. Use admin_cancel_with_credit.';
