
-- Fix "record not assigned yet" by initializing _coupon_row before conditional SELECT INTO
-- and guarding _affiliate.id checks against unassigned ROWTYPE.

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

  SELECT * INTO _product FROM public.products
    WHERE id = _product_id AND status = 'approved' AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF _product.seller_id = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;

  SELECT NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id = _buyer) INTO _is_first_order;

  -- Coupon
  _final_price := _product.display_price;
  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT v.coupon_id, v.discount, v.message
      INTO _coupon_id, _discount, _coupon_msg
      FROM public.validate_coupon(_coupon_code, _product.display_price) v;
    IF _coupon_id IS NOT NULL THEN
      _final_price := GREATEST(0, _product.display_price - COALESCE(_discount, 0));
    ELSE
      _discount := 0;
    END IF;
  END IF;

  -- Affiliate lookup (capture scalars only — no ROWTYPE that could be unassigned)
  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug)) > 0 THEN
    SELECT a.id, a.user_id, a.commission_percent
      INTO _affiliate_id, _affiliate_user, _affiliate_pct
      FROM public.affiliates a
     WHERE a.slug = _affiliate_slug AND a.status = 'approved';
    IF _affiliate_user = _buyer THEN
      _affiliate_id := NULL; _affiliate_user := NULL; _affiliate_pct := 0;
    END IF;
  END IF;

  -- Credential claim
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
  IF _buyer_balance IS NULL OR _buyer_balance < _final_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  _seller_share_pct := (100 - _commission_pct) / 100;
  _seller_earning := ROUND(_final_price * _seller_share_pct, 2);
  _commission := ROUND(_final_price - _seller_earning, 2);

  IF _affiliate_id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate_pct / 100, 2);
    IF _aff_commission > _commission THEN _aff_commission := _commission; END IF;
  END IF;

  UPDATE public.wallets SET balance = balance - _final_price, updated_at = now() WHERE user_id = _buyer;
  INSERT INTO public.wallets (user_id, balance) VALUES (_product.seller_id, _seller_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _final_price, _seller_earning, _commission - _aff_commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

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

  IF _affiliate_id IS NOT NULL AND _aff_commission > 0 THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_affiliate_user, _aff_commission)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate_id, _order_id, _buyer, _final_price, _affiliate_pct, _aff_commission);
    UPDATE public.affiliates
      SET total_conversions = total_conversions + 1,
          total_earned = total_earned + _aff_commission,
          updated_at = now()
      WHERE id = _affiliate_id;
  END IF;

  IF _is_first_order THEN
    SELECT referred_by INTO _referrer FROM public.profiles WHERE id = _buyer;
    IF _referrer IS NOT NULL THEN
      UPDATE public.referrals
        SET status = 'rewarded', reward_amount = 20, rewarded_at = now(), converted_at = COALESCE(converted_at, now())
        WHERE referred_user_id = _buyer AND status <> 'rewarded';
      IF FOUND THEN
        INSERT INTO public.wallets (user_id, balance) VALUES (_referrer, 20)
          ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + 20, updated_at = now();
      END IF;
    END IF;
  END IF;

  RETURN _order_id;
END; $function$;


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
    IF _coupon_id IS NOT NULL THEN
      _final_price := GREATEST(0, _product.display_price - COALESCE(_discount,0));
    ELSE
      _discount := 0;
    END IF;
  END IF;

  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug))>0 THEN
    SELECT a.id, a.user_id, a.commission_percent
      INTO _affiliate_id, _affiliate_user, _affiliate_pct
      FROM public.affiliates a WHERE a.slug = _affiliate_slug AND a.status='approved';
    IF _affiliate_user = _buyer THEN
      _affiliate_id := NULL; _affiliate_user := NULL; _affiliate_pct := 0;
    END IF;
  END IF;

  SELECT * INTO _cred FROM public.product_credentials
    WHERE product_id=_product_id AND status='available'
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;
  IF FOUND THEN
    _cred_email := _cred.cred_email; _cred_password := _cred.cred_password;
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
  INSERT INTO public.wallets (user_id, balance) VALUES (_product.seller_id, _seller_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at=now();

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _final_price, _seller_earning, _commission - _aff_commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

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
    INSERT INTO public.wallets (user_id, balance) VALUES (_affiliate_user, _aff_commission)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at=now();
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
        INSERT INTO public.wallets (user_id, balance) VALUES (_referrer, 20)
          ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + 20, updated_at=now();
      END IF;
    END IF;
  END IF;

  RETURN _order_id;
END; $function$;
