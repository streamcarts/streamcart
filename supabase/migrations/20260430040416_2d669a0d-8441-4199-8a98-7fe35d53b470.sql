-- Drop dependent trigger, alter columns, recreate trigger
DROP TRIGGER IF EXISTS trg_products_min_price ON public.products;

ALTER TABLE public.platforms ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.platforms ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.platforms ALTER COLUMN category SET DEFAULT 'Other';

ALTER TABLE public.products ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.products ALTER COLUMN category SET DEFAULT 'Other';

CREATE TRIGGER trg_products_min_price
  BEFORE INSERT OR UPDATE OF base_price, category ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_min_price();

ALTER TABLE public.platforms
  ADD COLUMN IF NOT EXISTS plan_tiers text[] NOT NULL DEFAULT ARRAY['Premium']::text[];