
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'Bundles';

CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'Package',
  min_price NUMERIC NOT NULL DEFAULT 0 CHECK (min_price >= 0),
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cats_public_read" ON public.product_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "cats_admin_all" ON public.product_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_product_categories_updated
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

INSERT INTO public.product_categories (name, icon, min_price, sort_order, is_active) VALUES
  ('OTT', 'Tv', 50, 10, true),
  ('AI Tools', 'Sparkles', 99, 20, true),
  ('VPN', 'ShieldCheck', 49, 30, true),
  ('Bundles', 'Package', 149, 40, true),
  ('Other', 'Box', 0, 90, true)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_category_min_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _min NUMERIC;
  _active BOOLEAN;
BEGIN
  SELECT min_price, is_active INTO _min, _active
    FROM public.product_categories
    WHERE name = NEW.category::text;
  IF _min IS NULL THEN
    RETURN NEW;
  END IF;
  IF _active = false THEN
    RAISE EXCEPTION 'Category "%" is not available for new listings', NEW.category;
  END IF;
  IF NEW.base_price < _min THEN
    RAISE EXCEPTION 'Price for "%" must be at least ₹%', NEW.category, _min;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_min_price ON public.products;
CREATE TRIGGER trg_products_min_price
  BEFORE INSERT OR UPDATE OF base_price, category ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_min_price();
