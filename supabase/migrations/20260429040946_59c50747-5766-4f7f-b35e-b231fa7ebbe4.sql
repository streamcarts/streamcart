CREATE OR REPLACE FUNCTION public.tg_auto_approve_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'hidden'::product_status THEN
    NEW.status := 'approved'::product_status;
  END IF;
  RETURN NEW;
END $$;