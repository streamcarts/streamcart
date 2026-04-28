
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'buyer');
CREATE TYPE public.application_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.product_status AS ENUM ('hidden', 'approved', 'rejected');
CREATE TYPE public.order_status AS ENUM ('completed', 'refunded');
CREATE TYPE public.topup_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.product_category AS ENUM ('OTT', 'AI Tools', 'VPN', 'SMM', 'Other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

-- ============ VENDOR APPLICATIONS ============
CREATE TABLE public.vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  status public.application_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (user_id)
);
ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  category public.product_category NOT NULL DEFAULT 'Other',
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  display_price NUMERIC(10,2) NOT NULL,
  credentials_email TEXT NOT NULL,
  credentials_password TEXT NOT NULL,
  duration TEXT,
  image_url TEXT,
  status public.product_status NOT NULL DEFAULT 'hidden',
  stock INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Trigger to auto-calculate display_price = base_price * 1.10
CREATE OR REPLACE FUNCTION public.set_display_price()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.display_price := ROUND(NEW.base_price * 1.10, 2);
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_set_display_price BEFORE INSERT OR UPDATE OF base_price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_display_price();

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ============ TOP-UPS ============
CREATE TABLE public.wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  upi_reference TEXT,
  screenshot_path TEXT NOT NULL,
  status public.topup_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  service_name TEXT NOT NULL,
  total_paid NUMERIC(10,2) NOT NULL,
  seller_earning NUMERIC(10,2) NOT NULL,
  admin_commission NUMERIC(10,2) NOT NULL,
  credentials_email TEXT NOT NULL,
  credentials_password TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  upi_id TEXT NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- ============ HANDLE NEW USER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer');
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============
-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- user_roles
CREATE POLICY "roles_self_select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- vendor_applications
CREATE POLICY "vapp_self_select" ON public.vendor_applications FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "vapp_self_insert" ON public.vendor_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "vapp_admin_update" ON public.vendor_applications FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- products: anyone (even anon) can view approved
CREATE POLICY "products_public_approved" ON public.products FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "products_seller_select_own" ON public.products FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "products_seller_insert" ON public.products FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "products_seller_update_own" ON public.products FOR UPDATE TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "products_seller_delete_own" ON public.products FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));

-- wallets
CREATE POLICY "wallets_self_select" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "wallets_admin_all" ON public.wallets FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- topups
CREATE POLICY "topups_self_select" ON public.wallet_topups FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "topups_self_insert" ON public.wallet_topups FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "topups_admin_update" ON public.wallet_topups FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- orders
CREATE POLICY "orders_buyer_select" ON public.orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "orders_admin_all" ON public.orders FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- withdrawals
CREATE POLICY "wd_self_select" ON public.withdrawals FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "wd_self_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid() AND public.has_role(auth.uid(), 'seller'));
CREATE POLICY "wd_admin_update" ON public.withdrawals FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('topup-screenshots', 'topup-screenshots', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;

-- topup-screenshots storage policies (private, user folder)
CREATE POLICY "topup_screens_user_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'topup-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "topup_screens_user_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'topup-screenshots' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin(auth.uid())));

-- product-images storage policies (public read, seller upload to own folder)
CREATE POLICY "product_images_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "product_images_seller_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "product_images_seller_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "product_images_seller_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ CHECKOUT RPC: atomic purchase + wallet credit + admin commission tracking ============
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _buyer UUID := auth.uid();
  _product public.products%ROWTYPE;
  _buyer_balance NUMERIC;
  _seller_earning NUMERIC;
  _commission NUMERIC;
  _order_id UUID;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _product FROM public.products WHERE id = _product_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF _product.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
  IF _product.seller_id = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;

  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id = _buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _product.display_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  _seller_earning := ROUND(_product.base_price, 2);
  _commission := ROUND(_product.display_price - _product.base_price, 2);

  -- Debit buyer
  UPDATE public.wallets SET balance = balance - _product.display_price, updated_at = now() WHERE user_id = _buyer;
  -- Credit seller (90%)
  INSERT INTO public.wallets (user_id, balance) VALUES (_product.seller_id, _seller_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  -- Decrement stock
  UPDATE public.products SET stock = stock - 1 WHERE id = _product.id;

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _product.display_price, _seller_earning, _commission, _product.credentials_email, _product.credentials_password)
  RETURNING id INTO _order_id;

  RETURN _order_id;
END; $$;

-- ============ APPROVE TOP-UP RPC ============
CREATE OR REPLACE FUNCTION public.approve_topup(_topup_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.wallet_topups%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _t FROM public.wallet_topups WHERE id = _topup_id FOR UPDATE;
  IF NOT FOUND OR _t.status <> 'pending' THEN RAISE EXCEPTION 'Invalid top-up'; END IF;
  UPDATE public.wallet_topups SET status='approved', reviewed_at=now() WHERE id=_topup_id;
  INSERT INTO public.wallets (user_id, balance) VALUES (_t.user_id, _t.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
END; $$;

-- ============ APPROVE WITHDRAWAL RPC ============
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_wd_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _w public.withdrawals%ROWTYPE; _bal NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Invalid withdrawal'; END IF;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _w.seller_id FOR UPDATE;
  IF _bal < _w.amount THEN RAISE EXCEPTION 'Insufficient seller balance'; END IF;
  UPDATE public.wallets SET balance = balance - _w.amount, updated_at=now() WHERE user_id=_w.seller_id;
  UPDATE public.withdrawals SET status='approved', reviewed_at=now() WHERE id=_wd_id;
END; $$;

-- ============ APPROVE VENDOR APPLICATION RPC ============
CREATE OR REPLACE FUNCTION public.approve_vendor(_app_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.vendor_applications%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _a FROM public.vendor_applications WHERE id = _app_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  UPDATE public.vendor_applications SET status='approved', reviewed_at=now() WHERE id=_app_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_a.user_id, 'seller') ON CONFLICT DO NOTHING;
END; $$;
