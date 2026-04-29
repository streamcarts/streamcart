-- 1) Add slug column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;

-- 2) Slug helpers
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.products_set_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  short text;
BEGIN
  base := public.slugify(NEW.service_name);
  IF base IS NULL OR base = '' THEN base := 'product'; END IF;
  short := substr(replace(NEW.id::text,'-',''), 1, 6);
  candidate := base || '-' || short;
  -- Only set/refresh slug if missing or service_name changed
  IF (TG_OP = 'INSERT')
     OR NEW.slug IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.service_name IS DISTINCT FROM OLD.service_name)
  THEN
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_slug ON public.products;
CREATE TRIGGER trg_products_slug
BEFORE INSERT OR UPDATE OF service_name ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_set_slug();

-- 3) Backfill existing rows
UPDATE public.products
SET slug = public.slugify(service_name) || '-' || substr(replace(id::text,'-',''), 1, 6)
WHERE slug IS NULL OR slug = '';

-- 4) Unique index for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products(slug);