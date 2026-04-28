-- Drop old UroPay artifacts
DROP FUNCTION IF EXISTS public.urpay_mark_paid(uuid, text);
DROP TABLE IF EXISTS public.payment_intents;

-- Create pending_orders table for manual UPI checkout
CREATE TABLE public.pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  upi_reference TEXT,
  screenshot_path TEXT NOT NULL,
  items JSONB NOT NULL,
  coupon_code TEXT,
  affiliate_slug TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  order_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_orders_buyer ON public.pending_orders(buyer_id);
CREATE INDEX idx_pending_orders_status ON public.pending_orders(status);

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_self_insert" ON public.pending_orders
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "po_self_select" ON public.pending_orders
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "po_admin_all" ON public.pending_orders
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Storage bucket for payment screenshots (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false)
  ON CONFLICT (id) DO NOTHING;

-- Buyer can upload to their own folder
CREATE POLICY "ps_buyer_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Buyer can view their own
CREATE POLICY "ps_buyer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-screenshots' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

-- Admin approve: processes each item via internal purchase logic, debiting from "credited" wallet first.
-- We credit buyer wallet then run purchase_product per item.
CREATE OR REPLACE FUNCTION public.approve_pending_order(_id UUID, _note TEXT DEFAULT NULL)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _po public.pending_orders%ROWTYPE;
  _admin UUID := auth.uid();
  _item JSONB;
  _qty INT;
  _pid UUID;
  _order_id UUID;
  _coupon_used BOOLEAN := false;
  _orders UUID[] := ARRAY[]::UUID[];
  _saved_uid UUID;
BEGIN
  IF NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _po FROM public.pending_orders WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pending order not found'; END IF;
  IF _po.status <> 'pending' THEN RAISE EXCEPTION 'Already %', _po.status; END IF;

  -- Credit buyer wallet by amount so purchase_product can debit
  INSERT INTO public.wallets (user_id, balance) VALUES (_po.buyer_id, _po.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  -- Impersonate buyer for purchase_product (it uses auth.uid()).
  -- Workaround: we can't change auth.uid(), so call a buyer-scoped internal procedure.
  -- Instead we replicate purchase_product inline by iterating items and calling a helper.
  FOR _item IN SELECT * FROM jsonb_array_elements(_po.items) LOOP
    _pid := (_item->>'id')::UUID;
    _qty := COALESCE((_item->>'qty')::INT, 1);
    FOR i IN 1.._qty LOOP
      _order_id := public._admin_purchase_for_buyer(
        _po.buyer_id,
        _pid,
        CASE WHEN NOT _coupon_used THEN _po.coupon_code ELSE NULL END,
        _po.affiliate_slug
      );
      _coupon_used := true;
      _orders := array_append(_orders, _order_id);
    END LOOP;
  END LOOP;

  UPDATE public.pending_orders
    SET status = 'approved', reviewed_at = now(), reviewed_by = _admin, admin_note = _note, order_ids = _orders, updated_at = now()
  WHERE id = _id;

  RETURN _orders;
END; $$;

-- Helper: same logic as purchase_product but takes buyer_id explicitly (admin calls it after crediting wallet)
CREATE OR REPLACE FUNCTION public._admin_purchase_for_buyer(
  _buyer UUID,
  _product_id UUID,
  _coupon_code TEXT DEFAULT NULL,
  _affiliate_slug TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  _coupon_row RECORD;
  _affiliate public.affiliates%ROWTYPE;
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
    SELECT c.id AS coupon_id,
           CASE WHEN c.discount_type='percent' THEN ROUND(_product.display_price * c.discount_value/100,2)
                ELSE LEAST(c.discount_value, _product.display_price) END AS discount
      INTO _coupon_row
      FROM public.coupons c WHERE c.code = upper(_coupon_code) AND c.is_active=true;
    IF FOUND THEN
      _discount := _coupon_row.discount;
      _final_price := GREATEST(0, _product.display_price - _discount);
    END IF;
  END IF;

  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug))>0 THEN
    SELECT * INTO _affiliate FROM public.affiliates WHERE slug = _affiliate_slug AND status='approved';
    IF FOUND AND _affiliate.user_id = _buyer THEN _affiliate := NULL; END IF;
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

  IF _affiliate.id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate.commission_percent/100, 2);
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

  IF _coupon_row.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_row.coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_row.coupon_id;
  END IF;

  IF _affiliate.id IS NOT NULL AND _aff_commission > 0 THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_affiliate.user_id, _aff_commission)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at=now();
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate.id, _order_id, _buyer, _final_price, _affiliate.commission_percent, _aff_commission);
    UPDATE public.affiliates SET total_conversions=total_conversions+1, total_earned=total_earned+_aff_commission, updated_at=now() WHERE id=_affiliate.id;
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
END; $$;

CREATE OR REPLACE FUNCTION public.reject_pending_order(_id UUID, _note TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.pending_orders
    SET status='rejected', reviewed_at=now(), reviewed_by=auth.uid(), admin_note=_note, updated_at=now()
  WHERE id=_id AND status='pending';
END; $$;