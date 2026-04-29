
-- =========================================================
-- 1. DUPLICATE PAYMENT PROTECTION (case-insensitive unique)
-- =========================================================

-- Cleanup: keep only first occurrence of any duplicates before adding constraints
WITH dups AS (
  SELECT id, row_number() OVER (PARTITION BY lower(txn_id) ORDER BY created_at) AS rn
  FROM public.pending_orders WHERE txn_id IS NOT NULL AND length(trim(txn_id)) > 0
)
UPDATE public.pending_orders p SET txn_id = NULL
FROM dups WHERE p.id = dups.id AND dups.rn > 1;

WITH dups AS (
  SELECT id, row_number() OVER (PARTITION BY lower(upi_reference) ORDER BY created_at) AS rn
  FROM public.wallet_topups WHERE upi_reference IS NOT NULL AND length(trim(upi_reference)) > 0
)
UPDATE public.wallet_topups t SET upi_reference = NULL
FROM dups WHERE t.id = dups.id AND dups.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_orders_txn_ci
  ON public.pending_orders ((lower(txn_id)))
  WHERE txn_id IS NOT NULL AND status IN ('pending','approved');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_wallet_topups_upi_ci
  ON public.wallet_topups ((lower(upi_reference)))
  WHERE upi_reference IS NOT NULL AND status IN ('pending','approved');

-- =========================================================
-- 2. EXPIRE UNPAID PENDING ORDERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _n INT;
BEGIN
  WITH upd AS (
    UPDATE public.pending_orders
       SET status = 'expired', updated_at = now()
     WHERE status = 'pending' AND expires_at <= now()
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM upd;
  RETURN _n;
END $$;

-- =========================================================
-- 3. COMPLAINT HARDENING
-- =========================================================
CREATE OR REPLACE FUNCTION public.file_complaint(_order_id uuid, _reason text, _details text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _id uuid;
  _uid uuid := auth.uid();
  _delivered_at timestamptz;
  _recent_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.buyer_id <> _uid THEN RAISE EXCEPTION 'Only the buyer can file a complaint'; END IF;

  -- Status gate
  IF _o.status::text NOT IN ('delivered','completed') THEN
    RAISE EXCEPTION 'Complaints are only allowed on delivered or completed orders';
  END IF;

  -- 7-day window from delivery (fall back to credentials_sent_at, then created_at)
  _delivered_at := COALESCE(_o.received_at, _o.credentials_sent_at, _o.created_at);
  IF _delivered_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Complaint window has expired (7 days after delivery)';
  END IF;

  -- Rate limit: max 1 complaint per 24h per buyer
  SELECT count(*) INTO _recent_count
    FROM public.complaints
    WHERE buyer_id = _uid AND created_at > now() - interval '24 hours';
  IF _recent_count >= 1 THEN
    RAISE EXCEPTION 'You can only file 1 complaint every 24 hours';
  END IF;

  IF EXISTS (SELECT 1 FROM public.complaints WHERE order_id = _order_id AND buyer_id = _uid AND status = 'open') THEN
    RAISE EXCEPTION 'You already have an open complaint on this order';
  END IF;

  INSERT INTO public.complaints (order_id, buyer_id, seller_id, reason, details)
  VALUES (_order_id, _uid, _o.seller_id, trim(_reason), NULLIF(trim(coalesce(_details,'')), ''))
  RETURNING id INTO _id;

  UPDATE public.profiles
    SET is_restricted = true,
        restriction_reason = COALESCE(restriction_reason, 'Buyer complaint pending review')
    WHERE id = _o.seller_id;

  UPDATE public.products
    SET is_active = false, updated_at = now()
    WHERE seller_id = _o.seller_id AND is_active = true;

  RETURN _id;
END $$;

-- =========================================================
-- 4. ATOMIC REFUND
-- =========================================================
CREATE OR REPLACE FUNCTION public.process_refund(_order_id uuid, _reason text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _refund_id uuid;
  _hold RECORD;
  _seller_pending NUMERIC := 0;
  _seller_balance NUMERIC := 0;
  _to_claw NUMERIC;
  _earning NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.refunds WHERE order_id = _order_id) THEN
    RAISE EXCEPTION 'Order already refunded';
  END IF;

  _earning := COALESCE(_o.seller_earning, 0);

  -- 1. Reverse any still-holding earnings for this order
  FOR _hold IN
    SELECT id, user_id, amount FROM public.earnings_holds
      WHERE order_id = _order_id AND status = 'holding' FOR UPDATE
  LOOP
    UPDATE public.wallets
      SET pending_balance = GREATEST(0, pending_balance - _hold.amount), updated_at = now()
      WHERE user_id = _hold.user_id;
    UPDATE public.earnings_holds SET status = 'refunded', released_at = now() WHERE id = _hold.id;
  END LOOP;

  -- 2. Claw back any earnings already released to seller's spendable balance
  _to_claw := _earning - COALESCE((
    SELECT sum(amount) FROM public.earnings_holds
      WHERE order_id = _order_id AND user_id = _o.seller_id AND status = 'refunded'
  ), 0);
  IF _to_claw > 0 THEN
    UPDATE public.wallets
      SET balance = balance - _to_claw, updated_at = now()
      WHERE user_id = _o.seller_id;
  END IF;

  -- 3. Refund buyer
  INSERT INTO public.wallets (user_id, balance) VALUES (_o.buyer_id, _o.total_paid)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  -- 4. Mark order
  UPDATE public.orders SET status = 'refunded' WHERE id = _order_id;

  -- 5. Close chat if any
  UPDATE public.order_chats SET status = 'cancelled', updated_at = now()
    WHERE order_id = _order_id AND status NOT IN ('completed','cancelled');

  -- 6. Record refund
  INSERT INTO public.refunds (order_id, buyer_id, seller_id, amount, reason, status, processed_by)
  VALUES (_order_id, _o.buyer_id, _o.seller_id, _o.total_paid, _reason, 'processed', auth.uid())
  RETURNING id INTO _refund_id;

  RETURN _refund_id;
END $$;

-- =========================================================
-- 5. SELLER RESTRICTION → BLOCK WITHDRAW
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _upi_id text, _qr_path text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _bal NUMERIC; _id UUID; _user UUID := auth.uid(); _restricted BOOLEAN; _banned BOOLEAN;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount < 100 THEN RAISE EXCEPTION 'Minimum withdrawal is ₹100'; END IF;
  IF _upi_id IS NULL OR length(trim(_upi_id)) < 3 THEN RAISE EXCEPTION 'UPI ID required'; END IF;

  SELECT is_restricted, is_banned INTO _restricted, _banned FROM public.profiles WHERE id = _user;
  IF _banned THEN RAISE EXCEPTION 'Account suspended'; END IF;
  IF _restricted THEN RAISE EXCEPTION 'Account temporarily restricted. Withdrawals are disabled.'; END IF;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.wallets
    SET balance = balance - _amount,
        pending_balance = pending_balance + _amount,
        updated_at = now()
    WHERE user_id = _user;

  INSERT INTO public.withdrawals (seller_id, amount, upi_id, qr_screenshot_path, status)
  VALUES (_user, _amount, trim(_upi_id), _qr_path, 'pending')
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- =========================================================
-- 6. CHAT RATE LIMIT (1 msg/sec)
-- =========================================================
CREATE OR REPLACE FUNCTION public.send_chat_message(_chat_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _chat public.order_chats%ROWTYPE;
  _uid UUID := auth.uid();
  _det RECORD;
  _msg_id UUID;
  _is_seller BOOLEAN;
  _flag_count INT;
  _last_at timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Message empty'; END IF;
  IF length(_body) > 2000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO _chat FROM public.order_chats WHERE id = _chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF _uid <> _chat.buyer_id AND _uid <> _chat.seller_id THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF _chat.status IN ('cancelled') THEN RAISE EXCEPTION 'Chat closed'; END IF;

  -- Rate limit: 1 message/second per sender per chat
  SELECT max(created_at) INTO _last_at FROM public.chat_messages
    WHERE chat_id = _chat_id AND sender_id = _uid;
  IF _last_at IS NOT NULL AND _last_at > now() - interval '1 second' THEN
    RAISE EXCEPTION 'Slow down — please wait a moment before sending again';
  END IF;

  _is_seller := (_uid = _chat.seller_id);
  SELECT * INTO _det FROM public.detect_contact_info(_body);

  IF _det.found THEN
    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body, is_flagged, flag_reason, is_blocked)
    VALUES (_chat_id, _uid, 'text',
      '⚠️ Message blocked: sharing contact information is not allowed on StreamCart.',
      true, _det.reason, true)
    RETURNING id INTO _msg_id;

    IF _is_seller THEN
      INSERT INTO public.seller_flags (seller_id, message_id, chat_id, reason, severity, message_preview)
      VALUES (_uid, _msg_id, _chat_id, _det.reason, 'high', left(_body, 200));
      SELECT count(*) INTO _flag_count FROM public.seller_flags
        WHERE seller_id = _uid AND resolved = false AND severity = 'high';
      IF _flag_count >= 3 THEN
        UPDATE public.profiles SET is_banned = true,
          ban_reason = COALESCE(ban_reason, 'Auto-ban: contact-info sharing in chat')
          WHERE id = _uid;
      END IF;
    ELSE
      INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
      VALUES (_uid, 'buyer_contact_share_attempt', 'low',
              jsonb_build_object('chat_id', _chat_id, 'reason', _det.reason));
    END IF;
    RETURN _msg_id;
  END IF;

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
  VALUES (_chat_id, _uid, 'text', _body)
  RETURNING id INTO _msg_id;
  UPDATE public.order_chats SET updated_at = now() WHERE id = _chat_id;
  RETURN _msg_id;
END $$;

-- =========================================================
-- 7. COUPON ABUSE — 1 welcome coupon per IP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ref_code TEXT;
  _referrer UUID;
  _new_code TEXT;
  _signup_ip TEXT;
  _coupon_code TEXT;
  _ip_signup_count INT := 0;
BEGIN
  _ref_code := upper(NULLIF(trim(NEW.raw_user_meta_data->>'ref_code'), ''));
  _signup_ip := NULLIF(NEW.raw_user_meta_data->>'signup_ip', '');

  INSERT INTO public.profiles (id, email, display_name, signup_ip)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), _signup_ip);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);

  _new_code := public.gen_referral_code(COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, NEW.id::text));
  INSERT INTO public.referral_codes (user_id, code) VALUES (NEW.id, _new_code);

  IF _ref_code IS NOT NULL THEN
    SELECT user_id INTO _referrer FROM public.referral_codes WHERE code = _ref_code;
    IF _referrer IS NOT NULL AND _referrer <> NEW.id THEN
      IF _signup_ip IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = _referrer AND signup_ip = _signup_ip
      ) THEN
        UPDATE public.profiles SET referred_by = _referrer WHERE id = NEW.id;
        INSERT INTO public.referrals (referrer_id, referred_user_id, code, signup_ip, user_agent)
        VALUES (_referrer, NEW.id, _ref_code, _signup_ip, NEW.raw_user_meta_data->>'user_agent')
        ON CONFLICT (referred_user_id) DO NOTHING;

        -- Issue welcome coupon ONLY if no other welcome coupon was already issued from this IP
        IF _signup_ip IS NOT NULL THEN
          SELECT count(*) INTO _ip_signup_count
            FROM public.coupons c
            JOIN public.profiles p ON p.id = c.owner_user_id
            WHERE c.auto_issue = true AND c.code LIKE 'WELCOME-%' AND p.signup_ip = _signup_ip;
        END IF;

        IF _ip_signup_count = 0 THEN
          _coupon_code := 'WELCOME-' || upper(substring(md5(NEW.id::text || now()::text), 1, 6));
          INSERT INTO public.coupons (code, discount_type, discount_value, max_uses, first_order_only, one_per_user, auto_issue, scope, owner_user_id, expires_at)
          VALUES (_coupon_code, 'percent', 5, 1, true, true, true, 'user', NEW.id, now() + interval '30 days');
        ELSE
          INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
          VALUES (NEW.id, 'welcome_coupon_ip_blocked', 'medium', jsonb_build_object('ip', _signup_ip));
        END IF;
      ELSE
        INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
        VALUES (NEW.id, 'self_referral_ip_match', 'high', jsonb_build_object('referrer_id', _referrer, 'ip', _signup_ip));
      END IF;
    END IF;
  END IF;

  IF _signup_ip IS NOT NULL AND (
    SELECT COUNT(*) FROM public.profiles WHERE signup_ip = _signup_ip
  ) > 3 THEN
    INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
    VALUES (NEW.id, 'multiple_signups_same_ip', 'medium', jsonb_build_object('ip', _signup_ip));
  END IF;

  RETURN NEW;
END $$;

-- =========================================================
-- 8. SECURITY HARDENING — restrict presence + clicks to authed
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.is_user_online(uuid) FROM anon;

DROP POLICY IF EXISTS aff_clicks_public_insert ON public.affiliate_clicks;
CREATE POLICY aff_clicks_authed_insert ON public.affiliate_clicks
  FOR INSERT TO authenticated WITH CHECK (true);

-- =========================================================
-- 9. SCHEDULER (every minute)
-- =========================================================
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'streamcart-tick';

SELECT cron.schedule(
  'streamcart-tick',
  '* * * * *',
  $$
    SELECT public.auto_complete_chat_orders();
    SELECT public.release_due_earnings();
    SELECT public.expire_pending_orders();
  $$
);
