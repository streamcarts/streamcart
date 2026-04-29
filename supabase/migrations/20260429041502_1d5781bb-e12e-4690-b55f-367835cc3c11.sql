-- ============ WALLET HOLD COLUMN ============
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS pending_balance NUMERIC NOT NULL DEFAULT 0;

-- ============ EARNINGS HOLD LEDGER ============
CREATE TABLE IF NOT EXISTS public.earnings_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,            -- 'sale' | 'affiliate' | 'referral'
  order_id UUID,
  status TEXT NOT NULL DEFAULT 'holding', -- holding | released | reversed
  release_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '3 days'),
  released_at TIMESTAMPTZ,
  released_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.earnings_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS holds_admin_all ON public.earnings_holds;
CREATE POLICY holds_admin_all ON public.earnings_holds FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS holds_self_select ON public.earnings_holds;
CREATE POLICY holds_self_select ON public.earnings_holds FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_holds_user_status ON public.earnings_holds(user_id, status);
CREATE INDEX IF NOT EXISTS idx_holds_release_at ON public.earnings_holds(release_at) WHERE status = 'holding';

-- ============ WITHDRAWAL QR + BUCKET ============
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS qr_screenshot_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('withdrawal-qrs', 'withdrawal-qrs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "wqr_self_upload" ON storage.objects;
CREATE POLICY "wqr_self_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'withdrawal-qrs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "wqr_self_read" ON storage.objects;
CREATE POLICY "wqr_self_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'withdrawal-qrs' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

-- ============ HELPERS: PUT EARNINGS INTO HOLD ============
CREATE OR REPLACE FUNCTION public.add_earning_to_hold(_user_id UUID, _amount NUMERIC, _source TEXT, _order_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.wallets (user_id, pending_balance)
    VALUES (_user_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET pending_balance = public.wallets.pending_balance + EXCLUDED.pending_balance, updated_at = now();
  INSERT INTO public.earnings_holds (user_id, amount, source, order_id)
    VALUES (_user_id, _amount, _source, _order_id);
END $$;

-- ============ AUTO-RELEASE AFTER 3 DAYS ============
CREATE OR REPLACE FUNCTION public.release_due_earnings()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r RECORD; _n INT := 0;
BEGIN
  FOR _r IN
    SELECT id, user_id, amount FROM public.earnings_holds
    WHERE status = 'holding' AND release_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.wallets
      SET balance = balance + _r.amount,
          pending_balance = GREATEST(0, pending_balance - _r.amount),
          updated_at = now()
      WHERE user_id = _r.user_id;
    UPDATE public.earnings_holds
      SET status = 'released', released_at = now()
      WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- ============ ADMIN: MANUAL RELEASE ============
CREATE OR REPLACE FUNCTION public.admin_release_hold(_hold_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _h public.earnings_holds%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _h FROM public.earnings_holds WHERE id = _hold_id FOR UPDATE;
  IF NOT FOUND OR _h.status <> 'holding' THEN RAISE EXCEPTION 'Invalid hold'; END IF;
  UPDATE public.wallets
    SET balance = balance + _h.amount,
        pending_balance = GREATEST(0, pending_balance - _h.amount),
        updated_at = now()
    WHERE user_id = _h.user_id;
  UPDATE public.earnings_holds
    SET status = 'released', released_at = now(), released_by = auth.uid()
    WHERE id = _h.id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_release_user_holds(_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _r RECORD; _n INT := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  FOR _r IN SELECT id, amount FROM public.earnings_holds
            WHERE user_id = _user_id AND status = 'holding' FOR UPDATE
  LOOP
    UPDATE public.wallets
      SET balance = balance + _r.amount,
          pending_balance = GREATEST(0, pending_balance - _r.amount),
          updated_at = now()
      WHERE user_id = _user_id;
    UPDATE public.earnings_holds
      SET status='released', released_at=now(), released_by=auth.uid()
      WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- ============ PATCH purchase_product TO USE HOLD ============
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id uuid, _coupon_code text DEFAULT NULL::text, _affiliate_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _buyer UUID := auth.uid();
  _product public.products%ROWTYPE;
  _buyer_balance NUMERIC;
  _seller_share_pct NUMERIC;
  _seller_earning NUMERIC;
  _commission NUMERIC;
  _order_id UUID;
  _cred public.product_credentials%ROWTYPE;
  _cred_email TEXT;
  _cred_password TEXT;
  _commission_pct NUMERIC;
  _is_banned BOOLEAN;
  _final_price NUMERIC;
  _discount NUMERIC := 0;
  _coupon_id UUID := NULL;
  _coupon_msg TEXT;
  _affiliate_id UUID := NULL;
  _affiliate_user UUID := NULL;
  _affiliate_pct NUMERIC := 0;
  _aff_commission NUMERIC := 0;
  _referrer UUID;
  _is_first_order BOOLEAN;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_banned INTO _is_banned FROM public.profiles WHERE id = _buyer;
  IF _is_banned THEN RAISE EXCEPTION 'Account suspended'; END IF;
  SELECT commission_percent INTO _commission_pct FROM public.platform_settings WHERE id = 1;
  IF _commission_pct IS NULL THEN _commission_pct := 10; END IF;
  SELECT * INTO _product FROM public.products WHERE id = _product_id AND status = 'approved' AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF _product.seller_id = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;
  SELECT NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id = _buyer) INTO _is_first_order;
  _final_price := _product.display_price;
  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT v.coupon_id, v.discount, v.message INTO _coupon_id, _discount, _coupon_msg
      FROM public.validate_coupon(_coupon_code, _product.display_price) v;
    IF _coupon_id IS NOT NULL THEN
      _final_price := GREATEST(0, _product.display_price - COALESCE(_discount, 0));
    ELSE _discount := 0; END IF;
  END IF;
  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug)) > 0 THEN
    SELECT a.id, a.user_id, a.commission_percent INTO _affiliate_id, _affiliate_user, _affiliate_pct
      FROM public.affiliates a WHERE a.slug = _affiliate_slug AND a.status = 'approved';
    IF _affiliate_user = _buyer THEN _affiliate_id := NULL; _affiliate_user := NULL; _affiliate_pct := 0; END IF;
  END IF;
  SELECT * INTO _cred FROM public.product_credentials
    WHERE product_id = _product_id AND status = 'available'
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
  IF FOUND THEN
    _cred_email := _cred.cred_email; _cred_password := _cred.cred_password;
  ELSE
    IF _product.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
    _cred_email := _product.credentials_email; _cred_password := _product.credentials_password;
  END IF;
  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id = _buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _final_price THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  _seller_share_pct := (100 - _commission_pct) / 100;
  _seller_earning := ROUND(_final_price * _seller_share_pct, 2);
  _commission := ROUND(_final_price - _seller_earning, 2);
  IF _affiliate_id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate_pct / 100, 2);
    IF _aff_commission > _commission THEN _aff_commission := _commission; END IF;
  END IF;

  -- Buyer pays from balance
  UPDATE public.wallets SET balance = balance - _final_price, updated_at = now() WHERE user_id = _buyer;

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _final_price, _seller_earning, _commission - _aff_commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

  -- Seller earning → 3-day HOLD
  PERFORM public.add_earning_to_hold(_product.seller_id, _seller_earning, 'sale', _order_id);

  IF _cred.id IS NOT NULL THEN
    UPDATE public.product_credentials SET status = 'assigned', assigned_order_id = _order_id, assigned_at = now() WHERE id = _cred.id;
  ELSE
    UPDATE public.products SET stock = stock - 1 WHERE id = _product.id;
  END IF;
  IF _coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  END IF;

  -- Affiliate commission → 3-day HOLD
  IF _affiliate_id IS NOT NULL AND _aff_commission > 0 THEN
    PERFORM public.add_earning_to_hold(_affiliate_user, _aff_commission, 'affiliate', _order_id);
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate_id, _order_id, _buyer, _final_price, _affiliate_pct, _aff_commission);
    UPDATE public.affiliates
      SET total_conversions = total_conversions + 1, total_earned = total_earned + _aff_commission, updated_at = now()
      WHERE id = _affiliate_id;
  END IF;

  -- Referral reward → 3-day HOLD
  IF _is_first_order THEN
    SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _buyer;
    IF _referrer IS NOT NULL THEN
      UPDATE public.referrals
        SET status = 'rewarded', reward_amount = 20, rewarded_at = now(), converted_at = COALESCE(converted_at, now())
        WHERE referred_user_id = _buyer AND status <> 'rewarded';
      IF FOUND THEN
        PERFORM public.add_earning_to_hold(_referrer, 20, 'referral', _order_id);
      END IF;
    END IF;
  END IF;
  RETURN _order_id;
END; $function$;

-- Mirror change in admin internal helper
CREATE OR REPLACE FUNCTION public._admin_purchase_for_buyer(_buyer uuid, _product_id uuid, _coupon_code text DEFAULT NULL::text, _affiliate_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product public.products%ROWTYPE;
  _buyer_balance NUMERIC;
  _seller_share_pct NUMERIC;
  _seller_earning NUMERIC;
  _commission NUMERIC;
  _order_id UUID;
  _cred public.product_credentials%ROWTYPE;
  _cred_email TEXT;
  _cred_password TEXT;
  _commission_pct NUMERIC;
  _final_price NUMERIC;
  _discount NUMERIC := 0;
  _coupon_id UUID := NULL;
  _affiliate_id UUID := NULL;
  _affiliate_user UUID := NULL;
  _affiliate_pct NUMERIC := 0;
  _aff_commission NUMERIC := 0;
  _referrer UUID;
  _is_first_order BOOLEAN;
BEGIN
  SELECT commission_percent INTO _commission_pct FROM public.platform_settings WHERE id = 1;
  IF _commission_pct IS NULL THEN _commission_pct := 10; END IF;
  SELECT * INTO _product FROM public.products WHERE id = _product_id AND status='approved' AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  SELECT NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id = _buyer) INTO _is_first_order;
  _final_price := _product.display_price;
  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code))>0 THEN
    SELECT c.id,
           CASE WHEN c.discount_type='percent' THEN ROUND(_product.display_price * c.discount_value/100,2)
                ELSE LEAST(c.discount_value, _product.display_price) END
      INTO _coupon_id, _discount
      FROM public.coupons c WHERE c.code = upper(_coupon_code) AND c.is_active=true;
    IF _coupon_id IS NOT NULL THEN _final_price := GREATEST(0, _product.display_price - COALESCE(_discount,0));
    ELSE _discount := 0; END IF;
  END IF;
  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug))>0 THEN
    SELECT a.id, a.user_id, a.commission_percent INTO _affiliate_id, _affiliate_user, _affiliate_pct
      FROM public.affiliates a WHERE a.slug = _affiliate_slug AND a.status='approved';
    IF _affiliate_user = _buyer THEN _affiliate_id := NULL; _affiliate_user := NULL; _affiliate_pct := 0; END IF;
  END IF;
  SELECT * INTO _cred FROM public.product_credentials
    WHERE product_id=_product_id AND status='available'
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
  IF FOUND THEN _cred_email := _cred.cred_email; _cred_password := _cred.cred_password;
  ELSE
    IF _product.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
    _cred_email := _product.credentials_email; _cred_password := _product.credentials_password;
  END IF;
  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id=_buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _final_price THEN
    RAISE EXCEPTION 'Insufficient buyer wallet for %', _product.service_name;
  END IF;
  _seller_share_pct := (100 - _commission_pct)/100;
  _seller_earning := ROUND(_final_price * _seller_share_pct, 2);
  _commission := ROUND(_final_price - _seller_earning, 2);
  IF _affiliate_id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate_pct/100, 2);
    IF _aff_commission > _commission THEN _aff_commission := _commission; END IF;
  END IF;
  UPDATE public.wallets SET balance=balance - _final_price, updated_at=now() WHERE user_id=_buyer;

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _final_price, _seller_earning, _commission - _aff_commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

  PERFORM public.add_earning_to_hold(_product.seller_id, _seller_earning, 'sale', _order_id);

  IF _cred.id IS NOT NULL THEN
    UPDATE public.product_credentials SET status='assigned', assigned_order_id=_order_id, assigned_at=now() WHERE id=_cred.id;
  ELSE
    UPDATE public.products SET stock = stock - 1 WHERE id = _product.id;
  END IF;
  IF _coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  END IF;
  IF _affiliate_id IS NOT NULL AND _aff_commission > 0 THEN
    PERFORM public.add_earning_to_hold(_affiliate_user, _aff_commission, 'affiliate', _order_id);
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate_id, _order_id, _buyer, _final_price, _affiliate_pct, _aff_commission);
    UPDATE public.affiliates SET total_conversions=total_conversions+1, total_earned=total_earned+_aff_commission, updated_at=now() WHERE id=_affiliate_id;
  END IF;
  IF _is_first_order THEN
    SELECT referred_by INTO _referrer FROM public.profiles WHERE id=_buyer;
    IF _referrer IS NOT NULL THEN
      UPDATE public.referrals SET status='rewarded', reward_amount=20, rewarded_at=now(), converted_at=COALESCE(converted_at, now())
        WHERE referred_user_id=_buyer AND status<>'rewarded';
      IF FOUND THEN
        PERFORM public.add_earning_to_hold(_referrer, 20, 'referral', _order_id);
      END IF;
    END IF;
  END IF;
  RETURN _order_id;
END; $function$;

-- ============ NEW WITHDRAWAL REQUEST RPC ============
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount NUMERIC, _upi_id TEXT, _qr_path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _bal NUMERIC; _id UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _upi_id IS NULL OR length(trim(_upi_id)) < 4 THEN RAISE EXCEPTION 'Valid UPI ID required'; END IF;
  IF _qr_path IS NULL OR length(_qr_path) = 0 THEN RAISE EXCEPTION 'UPI QR screenshot required'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF COALESCE(_bal,0) < _amount THEN RAISE EXCEPTION 'Insufficient withdrawable balance'; END IF;
  INSERT INTO public.withdrawals (seller_id, amount, upi_id, qr_screenshot_path)
    VALUES (_user, _amount, trim(_upi_id), _qr_path)
    RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ============ PATCH approve_withdrawal — removes seller-only check (admin can approve any) ============
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_wd_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _w public.withdrawals%ROWTYPE; _bal NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Invalid withdrawal'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _w.seller_id FOR UPDATE;
  IF _bal < _w.amount THEN RAISE EXCEPTION 'Insufficient user balance'; END IF;
  UPDATE public.wallets SET balance = balance - _w.amount, updated_at=now() WHERE user_id=_w.seller_id;
  UPDATE public.withdrawals SET status='approved', reviewed_at=now() WHERE id=_wd_id;
END; $function$;

-- ============ ADMIN: REJECT WITHDRAWAL ============
CREATE OR REPLACE FUNCTION public.reject_withdrawal(_wd_id uuid, _note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.withdrawals
    SET status='rejected', reviewed_at=now(), admin_note=_note
  WHERE id=_wd_id AND status='pending';
END; $function$;

-- Allow non-sellers (affiliates/referrers) to also create withdrawal rows via RPC
DROP POLICY IF EXISTS wd_self_insert ON public.withdrawals;
CREATE POLICY wd_self_insert ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());