-- Default new products to approved so seller listings go live instantly
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'approved'::product_status;

-- Trigger to force-approve any newly inserted product (unless admin explicitly sets otherwise via update)
CREATE OR REPLACE FUNCTION public.tg_auto_approve_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'hidden'::product_status OR NEW.status = 'pending'::product_status THEN
    NEW.status := 'approved'::product_status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_products_auto_approve ON public.products;
CREATE TRIGGER tg_products_auto_approve
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_approve_product();