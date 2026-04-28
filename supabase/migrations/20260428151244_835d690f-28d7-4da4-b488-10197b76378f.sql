
CREATE TYPE public.account_type AS ENUM ('private', 'shared');

CREATE TABLE IF NOT EXISTS public.category_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Package',
  price NUMERIC NOT NULL DEFAULT 0 CHECK (price >= 0),
  account_type public.account_type NOT NULL DEFAULT 'shared',
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_category_items_category ON public.category_items(category_id, sort_order);

ALTER TABLE public.category_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "citems_public_read" ON public.category_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "citems_admin_all" ON public.category_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_category_items_updated
  BEFORE UPDATE ON public.category_items
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
