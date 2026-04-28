
-- ============= 1. PLATFORM SETTINGS =============
CREATE TABLE public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_percent >= 0 AND commission_percent <= 90),
  featured_limit INTEGER NOT NULL DEFAULT 8,
  trending_limit INTEGER NOT NULL DEFAULT 12,
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  upi_id TEXT NOT NULL DEFAULT 'streamcart@upi',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.platform_settings (id) VALUES (1);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_public_read ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_admin_write ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= 2. USER BAN + PRODUCT PROMO + VENDOR FLAG =============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Allow admin updates on products (already covered by policy union; add explicit admin update so admin can edit any field)
CREATE POLICY products_admin_update ON public.products FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Allow admin select all profiles (already exists). Allow admin select all products via existing policy.

-- ============= 3. COUPONS =============
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed');

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type public.discount_type NOT NULL,
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses INTEGER,                -- null = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_public_read ON public.coupons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY coupons_admin_write ON public.coupons FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID,
  discount_applied NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY redemp_self_select ON public.coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY redemp_admin_all ON public.coupon_redemptions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= 4. REFUNDS =============
CREATE TYPE public.refund_status AS ENUM ('pending', 'processed', 'rejected');

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  status public.refund_status NOT NULL DEFAULT 'processed',
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY refunds_admin_all ON public.refunds FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY refunds_self_select ON public.refunds FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Add 'refunded' status to existing order_status enum if missing
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'refunded';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============= 5. SUPPORT TICKETS =============
CREATE TYPE public.ticket_status AS ENUM ('open', 'pending_user', 'closed');

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  category TEXT,
  status public.ticket_status NOT NULL DEFAULT 'open',
  related_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tickets_self_select ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY tickets_self_insert ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY tickets_admin_update ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()) OR user_id = auth.uid()) WITH CHECK (public.is_admin(auth.uid()) OR user_id = auth.uid());

CREATE POLICY tmsg_select ON public.ticket_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid())))
);
CREATE POLICY tmsg_insert ON public.ticket_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
);

-- ============= 6. ANNOUNCEMENTS =============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'buyers', 'sellers')),
  variant TEXT NOT NULL DEFAULT 'info' CHECK (variant IN ('info', 'success', 'warning', 'promo')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY anno_public_read ON public.announcements FOR SELECT TO anon, authenticated USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY anno_admin_write ON public.announcements FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= 7. FRAUD FLAGS =============
CREATE TABLE public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  signal TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  metadata JSONB,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_user_unresolved ON public.fraud_flags(user_id) WHERE resolved = false;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY fraud_admin_all ON public.fraud_flags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============= 8. RPCS =============

-- Ban / Unban
CREATE OR REPLACE FUNCTION public.set_user_ban(_user_id UUID, _banned BOOLEAN, _reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET is_banned = _banned, ban_reason = CASE WHEN _banned THEN _reason ELSE NULL END WHERE id = _user_id;
END; $$;

-- Validate coupon (read-only helper for checkout UI)
CREATE OR REPLACE FUNCTION public.validate_coupon(_code TEXT, _subtotal NUMERIC)
RETURNS TABLE (coupon_id UUID, discount NUMERIC, message TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.coupons%ROWTYPE; _disc NUMERIC;
BEGIN
  SELECT * INTO _c FROM public.coupons WHERE code = upper(_code) AND is_active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Invalid code'::TEXT; RETURN; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Code expired'::TEXT; RETURN; END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Code fully redeemed'::TEXT; RETURN; END IF;
  IF _subtotal < _c.min_order_value THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, ('Minimum order ₹' || _c.min_order_value)::TEXT; RETURN; END IF;
  _disc := CASE WHEN _c.discount_type = 'percent' THEN ROUND(_subtotal * _c.discount_value / 100, 2) ELSE LEAST(_c.discount_value, _subtotal) END;
  RETURN QUERY SELECT _c.id, _disc, 'Applied'::TEXT;
END; $$;

-- Refund order: reverse wallet, mark refunded, return credential to pool
CREATE OR REPLACE FUNCTION public.issue_refund(_order_id UUID, _reason TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.orders%ROWTYPE; _refund_id UUID; _admin UUID := auth.uid();
BEGIN
  IF NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status = 'refunded' THEN RAISE EXCEPTION 'Already refunded'; END IF;

  -- Credit buyer back the full paid amount
  UPDATE public.wallets SET balance = balance + _o.total_paid, updated_at = now() WHERE user_id = _o.buyer_id;
  -- Debit seller's earning back (allow negative; admin can resolve)
  UPDATE public.wallets SET balance = balance - _o.seller_earning, updated_at = now() WHERE user_id = _o.seller_id;

  -- Free credential back to pool if attached
  IF _o.credential_id IS NOT NULL THEN
    UPDATE public.product_credentials SET status = 'available', assigned_order_id = NULL, assigned_at = NULL WHERE id = _o.credential_id;
  END IF;

  UPDATE public.orders SET status = 'refunded' WHERE id = _o.id;

  INSERT INTO public.refunds (order_id, buyer_id, seller_id, amount, reason, status, processed_by)
  VALUES (_o.id, _o.buyer_id, _o.seller_id, _o.total_paid, _reason, 'processed', _admin)
  RETURNING id INTO _refund_id;

  RETURN _refund_id;
END; $$;

-- Upgrade purchase RPC: dynamic commission, ban check, optional coupon
DROP FUNCTION IF EXISTS public.purchase_product(uuid);

CREATE OR REPLACE FUNCTION public.purchase_product(_product_id UUID, _coupon_code TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  _coupon_row RECORD;
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

  -- Optional coupon
  _final_price := _product.display_price;
  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT * INTO _coupon_row FROM public.validate_coupon(_coupon_code, _product.display_price);
    IF _coupon_row.coupon_id IS NOT NULL THEN
      _discount := _coupon_row.discount;
      _final_price := GREATEST(0, _product.display_price - _discount);
    END IF;
  END IF;

  -- Try claim credential atomically
  SELECT * INTO _cred FROM public.product_credentials
    WHERE product_id = _product_id AND status = 'available'
    ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1;

  IF FOUND THEN
    _cred_email := _cred.cred_email;
    _cred_password := _cred.cred_password;
  ELSE
    IF _product.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
    _cred_email := _product.credentials_email;
    _cred_password := _product.credentials_password;
  END IF;

  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id = _buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _final_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Dynamic split: seller gets (100 - commission_pct)% of final_price; admin keeps the rest
  _seller_share_pct := (100 - _commission_pct) / 100;
  _seller_earning := ROUND(_final_price * _seller_share_pct, 2);
  _commission := ROUND(_final_price - _seller_earning, 2);

  UPDATE public.wallets SET balance = balance - _final_price, updated_at = now() WHERE user_id = _buyer;
  INSERT INTO public.wallets (user_id, balance) VALUES (_product.seller_id, _seller_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _final_price, _seller_earning, _commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

  IF _cred.id IS NOT NULL THEN
    UPDATE public.product_credentials SET status = 'assigned', assigned_order_id = _order_id, assigned_at = now() WHERE id = _cred.id;
  ELSE
    UPDATE public.products SET stock = stock - 1 WHERE id = _product.id;
  END IF;

  -- Record coupon redemption + bump used_count
  IF _coupon_row.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_row.coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_row.coupon_id;
  END IF;

  RETURN _order_id;
END; $$;
