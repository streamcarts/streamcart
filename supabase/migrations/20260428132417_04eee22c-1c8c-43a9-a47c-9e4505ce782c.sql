
-- 1. Vendor application fields
ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS experience TEXT;

-- 2. Product fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;

-- 3. Credential pool
CREATE TYPE public.credential_status AS ENUM ('available', 'assigned');

CREATE TABLE public.product_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  cred_email TEXT NOT NULL,
  cred_password TEXT NOT NULL,
  access_link TEXT,
  notes TEXT,
  status public.credential_status NOT NULL DEFAULT 'available',
  assigned_order_id UUID,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pcred_product_status ON public.product_credentials(product_id, status);
CREATE INDEX idx_pcred_seller ON public.product_credentials(seller_id);

ALTER TABLE public.product_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcred_seller_all ON public.product_credentials
  FOR ALL TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (seller_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY pcred_buyer_view_assigned ON public.product_credentials
  FOR SELECT TO authenticated
  USING (
    assigned_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = product_credentials.assigned_order_id AND o.buyer_id = auth.uid()
    )
  );

-- 4. Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  product_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_product ON public.reviews(product_id);
CREATE INDEX idx_reviews_seller ON public.reviews(seller_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_public_select ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reviews_buyer_insert ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
  );
CREATE POLICY reviews_buyer_update ON public.reviews FOR UPDATE TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY reviews_admin_all ON public.reviews FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- 5. Orders: link credential
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS credential_id UUID;

-- 6. Trigger to recompute product rating
CREATE OR REPLACE FUNCTION public.recompute_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _pid UUID;
BEGIN
  _pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products SET
    avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE product_id = _pid), 0),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = _pid)
  WHERE id = _pid;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_reviews_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_product_rating();

-- 7. Trigger to keep product.stock in sync with available credentials
CREATE OR REPLACE FUNCTION public.sync_product_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _pid UUID;
BEGIN
  _pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products
    SET stock = (SELECT COUNT(*) FROM public.product_credentials WHERE product_id = _pid AND status = 'available')
  WHERE id = _pid AND EXISTS (SELECT 1 FROM public.product_credentials WHERE product_id = _pid);
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_pcred_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_credentials
FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock();

-- 8. Upgraded purchase_product RPC: pool-aware, atomic, prevents oversell
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _buyer UUID := auth.uid();
  _product public.products%ROWTYPE;
  _buyer_balance NUMERIC;
  _seller_earning NUMERIC;
  _commission NUMERIC;
  _order_id UUID;
  _cred public.product_credentials%ROWTYPE;
  _cred_email TEXT;
  _cred_password TEXT;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO _product FROM public.products
    WHERE id = _product_id AND status = 'approved' AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF _product.seller_id = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;

  -- Try to claim a credential from the pool atomically
  SELECT * INTO _cred FROM public.product_credentials
    WHERE product_id = _product_id AND status = 'available'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF FOUND THEN
    _cred_email := _cred.cred_email;
    _cred_password := _cred.cred_password;
  ELSE
    -- Fallback to legacy single credential on product
    IF _product.stock <= 0 THEN RAISE EXCEPTION 'Out of stock'; END IF;
    _cred_email := _product.credentials_email;
    _cred_password := _product.credentials_password;
  END IF;

  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id = _buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _product.display_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  _seller_earning := ROUND(_product.base_price, 2);
  _commission := ROUND(_product.display_price - _product.base_price, 2);

  UPDATE public.wallets SET balance = balance - _product.display_price, updated_at = now() WHERE user_id = _buyer;
  INSERT INTO public.wallets (user_id, balance) VALUES (_product.seller_id, _seller_earning)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.orders (buyer_id, seller_id, product_id, service_name, total_paid, seller_earning, admin_commission, credentials_email, credentials_password, credential_id)
  VALUES (_buyer, _product.seller_id, _product.id, _product.service_name, _product.display_price, _seller_earning, _commission, _cred_email, _cred_password, _cred.id)
  RETURNING id INTO _order_id;

  IF _cred.id IS NOT NULL THEN
    UPDATE public.product_credentials
      SET status = 'assigned', assigned_order_id = _order_id, assigned_at = now()
      WHERE id = _cred.id;
  ELSE
    UPDATE public.products SET stock = stock - 1 WHERE id = _product.id;
  END IF;

  RETURN _order_id;
END; $$;
