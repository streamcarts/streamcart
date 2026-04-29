
-- =====================================================
-- 1. ADMIN-SAFE CREDENTIAL REDACTION
-- =====================================================
-- We don't change ownership/RLS on the base tables (buyers + sellers still need them).
-- Instead provide a redacted view + a strict reader function the Admin UI must use.

CREATE OR REPLACE FUNCTION public.redact_secret(_v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _v IS NULL OR length(_v) = 0 THEN NULL
    WHEN length(_v) <= 4 THEN repeat('•', length(_v))
    ELSE repeat('•', GREATEST(length(_v) - 2, 4)) || right(_v, 2)
  END
$$;

CREATE OR REPLACE VIEW public.admin_orders_safe
WITH (security_invoker = true)
AS
SELECT
  o.id, o.buyer_id, o.seller_id, o.product_id, o.service_name, o.tier_label,
  o.total_paid, o.seller_earning, o.admin_commission, o.delivery_mode,
  o.status, o.chat_id, o.created_at, o.received_at, o.credentials_sent_at,
  CASE WHEN public.is_admin(auth.uid())
       THEN public.redact_secret(o.credentials_email)
       ELSE o.credentials_email END AS credentials_email_masked,
  CASE WHEN public.is_admin(auth.uid())
       THEN public.redact_secret(o.credentials_password)
       ELSE NULL END AS credentials_password_masked
FROM public.orders o
WHERE public.is_admin(auth.uid());

GRANT SELECT ON public.admin_orders_safe TO authenticated;

-- =====================================================
-- 2. DEVICE / IP TRACKING
-- =====================================================
CREATE TABLE IF NOT EXISTS public.device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_fp text,
  ip text,
  user_agent text,
  event text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user ON public.device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_fp ON public.device_sessions(device_fp);
CREATE INDEX IF NOT EXISTS idx_device_sessions_ip ON public.device_sessions(ip);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_self_select ON public.device_sessions;
CREATE POLICY dev_self_select ON public.device_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS dev_admin_all ON public.device_sessions;
CREATE POLICY dev_admin_all ON public.device_sessions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_device_session(_device_fp text, _ip text, _user_agent text, _event text DEFAULT 'login')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _id uuid; _shared int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.device_sessions (user_id, device_fp, ip, user_agent, event)
  VALUES (auth.uid(), NULLIF(_device_fp,''), NULLIF(_ip,''), NULLIF(_user_agent,''), COALESCE(_event,'login'))
  RETURNING id INTO _id;

  -- Flag if device fingerprint is shared by >3 distinct users
  IF _device_fp IS NOT NULL AND length(_device_fp) > 4 THEN
    SELECT count(DISTINCT user_id) INTO _shared
      FROM public.device_sessions
      WHERE device_fp = _device_fp;
    IF _shared > 3 THEN
      INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
      VALUES (auth.uid(), 'shared_device_fingerprint', 'medium',
              jsonb_build_object('device_fp', _device_fp, 'distinct_users', _shared));
    END IF;
  END IF;
  RETURN _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_device_session(text,text,text,text) FROM anon;

-- =====================================================
-- 3. RISK SCORING
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_risk_score(_user_id uuid)
RETURNS TABLE(score int, level text, reasons jsonb)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _s int := 0;
  _r jsonb := '[]'::jsonb;
  _open_complaints int := 0;
  _high_fraud int := 0;
  _med_fraud int := 0;
  _distinct_ips int := 0;
  _distinct_devs int := 0;
  _restricted boolean := false;
  _banned boolean := false;
  _level text;
BEGIN
  -- Only admins or the user themselves can see their own score
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT public.is_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT is_restricted, is_banned INTO _restricted, _banned
    FROM public.profiles WHERE id = _user_id;

  IF _banned THEN _s := _s + 100; _r := _r || jsonb_build_array('account_banned'); END IF;
  IF _restricted THEN _s := _s + 40; _r := _r || jsonb_build_array('account_restricted'); END IF;

  SELECT count(*) INTO _open_complaints FROM public.complaints
    WHERE seller_id = _user_id AND status = 'open';
  IF _open_complaints > 0 THEN
    _s := _s + LEAST(_open_complaints * 25, 60);
    _r := _r || jsonb_build_array('open_complaints:' || _open_complaints);
  END IF;

  SELECT count(*) INTO _high_fraud FROM public.fraud_flags
    WHERE user_id = _user_id AND resolved = false AND severity = 'high';
  SELECT count(*) INTO _med_fraud FROM public.fraud_flags
    WHERE user_id = _user_id AND resolved = false AND severity = 'medium';
  IF _high_fraud > 0 THEN _s := _s + _high_fraud * 30; _r := _r || jsonb_build_array('high_fraud_flags:' || _high_fraud); END IF;
  IF _med_fraud > 0 THEN _s := _s + _med_fraud * 10; _r := _r || jsonb_build_array('medium_fraud_flags:' || _med_fraud); END IF;

  SELECT count(DISTINCT ip) INTO _distinct_ips FROM public.device_sessions
    WHERE user_id = _user_id AND ip IS NOT NULL;
  IF _distinct_ips > 5 THEN _s := _s + 10; _r := _r || jsonb_build_array('many_ips:' || _distinct_ips); END IF;

  SELECT count(DISTINCT device_fp) INTO _distinct_devs FROM public.device_sessions
    WHERE user_id = _user_id AND device_fp IS NOT NULL;
  IF _distinct_devs > 5 THEN _s := _s + 10; _r := _r || jsonb_build_array('many_devices:' || _distinct_devs); END IF;

  IF _s >= 80 THEN _level := 'critical';
  ELSIF _s >= 50 THEN _level := 'high';
  ELSIF _s >= 25 THEN _level := 'medium';
  ELSE _level := 'low'; END IF;

  RETURN QUERY SELECT LEAST(_s, 100), _level, _r;
END $$;

-- =====================================================
-- 4. VERIFIED SELLER FLAG
-- =====================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_seller boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_seller_verified(_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (COALESCE((SELECT is_verified_seller FROM public.profiles WHERE id = _seller_id), false))
    OR
    (
      (SELECT count(*) FROM public.orders WHERE seller_id = _seller_id AND status = 'completed') >= 5
      AND NOT COALESCE((SELECT is_restricted FROM public.profiles WHERE id = _seller_id), false)
      AND NOT EXISTS (SELECT 1 FROM public.complaints WHERE seller_id = _seller_id AND status = 'open')
    );
$$;
