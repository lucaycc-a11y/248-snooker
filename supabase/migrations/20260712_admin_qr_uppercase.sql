-- Fix generate_admin_qr(): encode(..., 'hex') returns lowercase hex digits,
-- so admin QR codes came out as SPACE8-ADMIN-a3f9c21b... while every other
-- code in the system (member_code, human_code) is uppercase. Wrap in upper()
-- so admin QR codes match the same all-caps format everywhere else.
CREATE OR REPLACE FUNCTION generate_admin_qr()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_admin_id UUID;
  v_qr_code TEXT;
  v_generated_at TIMESTAMPTZ;
BEGIN
  -- 1. 獲取當前用戶ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. 檢查係咪active admin
  SELECT id INTO v_admin_id
  FROM admin_users
  WHERE user_id = v_user_id
    AND invite_status = 'active';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- 3. 生成新QR code (SPACE8-ADMIN-{random 16 uppercase hex chars})
  v_qr_code := 'SPACE8-ADMIN-' || upper(encode(gen_random_bytes(8), 'hex'));
  v_generated_at := now();

  -- 4. 更新admin_users表
  UPDATE admin_users
  SET
    admin_qr_code = v_qr_code,
    admin_qr_generated_at = v_generated_at
  WHERE id = v_admin_id;

  -- 5. 返回QR code同到期時間
  RETURN json_build_object(
    'qr_code', v_qr_code,
    'generated_at', v_generated_at,
    'expires_at', v_generated_at + interval '24 hours'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION generate_admin_qr() TO authenticated;
