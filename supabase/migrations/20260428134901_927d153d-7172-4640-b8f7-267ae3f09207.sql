
-- =========================
-- REFERRALS
-- =========================
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_user_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | converted | rewarded
  signup_ip TEXT,
  user_agent TEXT,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  rewarded_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rcodes_public_read" ON public.referral_codes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rcodes_admin_all" ON public.referral_codes FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "refs_self_select" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "refs_admin_all" ON public.referrals FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================
-- AFFILIATES
-- =========================
CREATE TYPE affiliate_status AS ENUM ('pending','approved','suspended');

CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  commission_percent NUMERIC NOT NULL DEFAULT 20 CHECK (commission_percent BETWEEN 0 AND 50),
  status affiliate_status NOT NULL DEFAULT 'pending',
  total_clicks INTEGER NOT NULL DEFAULT 0,
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL,
  slug TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  referrer_url TEXT,
  landing_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_clicks_affiliate ON public.affiliate_clicks(affiliate_id);

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL,
  order_id UUID NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  order_total NUMERIC NOT NULL,
  commission_percent NUMERIC NOT NULL,
  commission_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid', -- paid | reversed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aff_conv_affiliate ON public.affiliate_conversions(affiliate_id);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aff_public_lookup" ON public.affiliates FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "aff_self_select" ON public.affiliates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "aff_admin_all" ON public.affiliates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "aff_clicks_admin_all" ON public.affiliate_clicks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "aff_clicks_self_read" ON public.affiliate_clicks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_clicks.affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "aff_clicks_public_insert" ON public.affiliate_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "aff_conv_admin_all" ON public.affiliate_conversions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "aff_conv_self_read" ON public.affiliate_conversions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_conversions.affiliate_id AND a.user_id = auth.uid()));

-- =========================
-- COUPON UPGRADES
-- =========================
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS one_per_user BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS auto_issue BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'global'; -- global | user
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS owner_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_coupons_owner ON public.coupons(owner_user_id);

-- Profiles: track signup IP & referred-by for fraud detection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- =========================
-- HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.gen_referral_code(_seed TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE _code TEXT; _try INT := 0;
BEGIN
  LOOP
    _code := upper(substring(regexp_replace(_seed, '[^a-zA-Z0-9]', '', 'g') || md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.referral_codes WHERE code = _code);
    _try := _try + 1;
    IF _try > 8 THEN _code := upper(substring(md5(random()::text), 1, 8)); EXIT; END IF;
  END LOOP;
  RETURN _code;
END; $$;

-- Backfill referral codes for existing users
INSERT INTO public.referral_codes (user_id, code)
SELECT p.id, public.gen_referral_code(COALESCE(p.display_name, p.email, p.id::text))
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

-- =========================
-- UPDATED handle_new_user (issue referral code, accept referral, auto-issue welcome coupon)
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref_code TEXT;
  _referrer UUID;
  _new_code TEXT;
  _signup_ip TEXT;
  _coupon_code TEXT;
BEGIN
  _ref_code := upper(NULLIF(trim(NEW.raw_user_meta_data->>'ref_code'), ''));
  _signup_ip := NULLIF(NEW.raw_user_meta_data->>'signup_ip', '');

  INSERT INTO public.profiles (id, email, display_name, signup_ip)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), _signup_ip);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);

  -- Referral code for the new user
  _new_code := public.gen_referral_code(COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, NEW.id::text));
  INSERT INTO public.referral_codes (user_id, code) VALUES (NEW.id, _new_code);

  -- Honor referral if a valid code was supplied
  IF _ref_code IS NOT NULL THEN
    SELECT user_id INTO _referrer FROM public.referral_codes WHERE code = _ref_code;
    IF _referrer IS NOT NULL AND _referrer <> NEW.id THEN
      -- Block IP-collision self-referral
      IF _signup_ip IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = _referrer AND signup_ip = _signup_ip
      ) THEN
        UPDATE public.profiles SET referred_by = _referrer WHERE id = NEW.id;
        INSERT INTO public.referrals (referrer_id, referred_user_id, code, signup_ip, user_agent)
        VALUES (_referrer, NEW.id, _ref_code, _signup_ip, NEW.raw_user_meta_data->>'user_agent')
        ON CONFLICT (referred_user_id) DO NOTHING;

        -- Issue 5% welcome coupon, first-order-only, one-per-user
        _coupon_code := 'WELCOME-' || upper(substring(md5(NEW.id::text || now()::text), 1, 6));
        INSERT INTO public.coupons (code, discount_type, discount_value, max_uses, first_order_only, one_per_user, auto_issue, scope, owner_user_id, expires_at)
        VALUES (_coupon_code, 'percent', 5, 1, true, true, true, 'user', NEW.id, now() + interval '30 days');
      ELSE
        INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
        VALUES (NEW.id, 'self_referral_ip_match', 'high', jsonb_build_object('referrer_id', _referrer, 'ip', _signup_ip));
      END IF;
    END IF;
  END IF;

  -- Multiple-accounts-from-same-IP signal
  IF _signup_ip IS NOT NULL AND (
    SELECT COUNT(*) FROM public.profiles WHERE signup_ip = _signup_ip
  ) > 3 THEN
    INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
    VALUES (NEW.id, 'multiple_signups_same_ip', 'medium', jsonb_build_object('ip', _signup_ip));
  END IF;

  RETURN NEW;
END; $$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- VALIDATE COUPON (extended)
-- =========================
CREATE OR REPLACE FUNCTION public.validate_coupon(_code TEXT, _subtotal NUMERIC)
RETURNS TABLE(coupon_id UUID, discount NUMERIC, message TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.coupons%ROWTYPE;
  _disc NUMERIC;
  _user UUID := auth.uid();
  _has_orders BOOLEAN;
  _used_already BOOLEAN;
BEGIN
  SELECT * INTO _c FROM public.coupons WHERE code = upper(_code) AND is_active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Invalid code'::TEXT; RETURN; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Code expired'::TEXT; RETURN; END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Code fully redeemed'::TEXT; RETURN; END IF;
  IF _subtotal < _c.min_order_value THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, ('Minimum order ₹' || _c.min_order_value)::TEXT; RETURN; END IF;

  -- Scope: user-bound coupon
  IF _c.scope = 'user' THEN
    IF _user IS NULL OR _c.owner_user_id IS NULL OR _c.owner_user_id <> _user THEN
      RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Code not valid for this account'::TEXT; RETURN;
    END IF;
  END IF;

  IF _user IS NOT NULL THEN
    -- One per user
    IF _c.one_per_user THEN
      SELECT EXISTS(SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = _c.id AND user_id = _user) INTO _used_already;
      IF _used_already THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Already used'::TEXT; RETURN; END IF;
    END IF;
    -- First-order only
    IF _c.first_order_only THEN
      SELECT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id = _user) INTO _has_orders;
      IF _has_orders THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, 'Valid only on first order'::TEXT; RETURN; END IF;
    END IF;
  END IF;

  _disc := CASE WHEN _c.discount_type = 'percent' THEN ROUND(_subtotal * _c.discount_value / 100, 2)
                ELSE LEAST(_c.discount_value, _subtotal) END;
  RETURN QUERY SELECT _c.id, _disc, 'Applied'::TEXT;
END; $$;

-- =========================
-- PURCHASE_PRODUCT (extended for affiliate + referral rewards)
-- =========================
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id UUID, _coupon_code TEXT DEFAULT NULL, _affiliate_slug TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  _affiliate public.affiliates%ROWTYPE;
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
    SELECT * INTO _coupon_row FROM public.validate_coupon(_coupon_code, _product.display_price);
    IF _coupon_row.coupon_id IS NOT NULL THEN
      _discount := _coupon_row.discount;
      _final_price := GREATEST(0, _product.display_price - _discount);
    END IF;
  END IF;

  -- Affiliate lookup
  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug)) > 0 THEN
    SELECT * INTO _affiliate FROM public.affiliates WHERE slug = _affiliate_slug AND status = 'approved';
    IF FOUND AND _affiliate.user_id = _buyer THEN _affiliate := NULL; END IF; -- block self
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

  -- Affiliate commission comes out of admin's share
  IF _affiliate.id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate.commission_percent / 100, 2);
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

  -- Coupon redemption
  IF _coupon_row.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_row.coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_row.coupon_id;
  END IF;

  -- Affiliate payout to wallet
  IF _affiliate.id IS NOT NULL AND _aff_commission > 0 THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_affiliate.user_id, _aff_commission)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate.id, _order_id, _buyer, _final_price, _affiliate.commission_percent, _aff_commission);
    UPDATE public.affiliates
      SET total_conversions = total_conversions + 1,
          total_earned = total_earned + _aff_commission,
          updated_at = now()
      WHERE id = _affiliate.id;
  END IF;

  -- Referral reward: pay referrer ₹20 on referred user's FIRST order
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
END; $$;

-- =========================
-- ADMIN HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.admin_set_affiliate(_user_id UUID, _slug TEXT, _commission NUMERIC, _status affiliate_status DEFAULT 'approved')
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _commission < 0 OR _commission > 50 THEN RAISE EXCEPTION 'Commission must be 0–50'; END IF;
  INSERT INTO public.affiliates (user_id, slug, commission_percent, status, approved_at)
  VALUES (_user_id, lower(_slug), _commission, _status, CASE WHEN _status='approved' THEN now() END)
  ON CONFLICT (user_id) DO UPDATE
    SET slug = EXCLUDED.slug, commission_percent = EXCLUDED.commission_percent,
        status = EXCLUDED.status, approved_at = COALESCE(public.affiliates.approved_at, EXCLUDED.approved_at),
        updated_at = now()
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.track_affiliate_click(_slug TEXT, _ip TEXT, _ua TEXT, _ref TEXT, _path TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _aff public.affiliates%ROWTYPE;
BEGIN
  SELECT * INTO _aff FROM public.affiliates WHERE slug = lower(_slug) AND status = 'approved';
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.affiliate_clicks (affiliate_id, slug, ip, user_agent, referrer_url, landing_path)
  VALUES (_aff.id, _aff.slug, _ip, _ua, _ref, _path);
  UPDATE public.affiliates SET total_clicks = total_clicks + 1, updated_at = now() WHERE id = _aff.id;
END; $$;
