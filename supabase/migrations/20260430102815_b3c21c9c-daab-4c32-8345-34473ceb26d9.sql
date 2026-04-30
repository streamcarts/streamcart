-- Add is_pack flag to products to mark multi-platform packs
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_pack boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pack_platforms jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add a "Sale ends in" optional timestamp to enable per-product countdown timer
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz;

-- Insert "Packs" category if not present (idempotent)
INSERT INTO public.product_categories (name, icon, sort_order, is_active, min_price)
SELECT 'Packs', 'Box', 5, true, 0
WHERE NOT EXISTS (SELECT 1 FROM public.product_categories WHERE name = 'Packs');