-- Trigger to send "new order" emails to seller + admins after an order is inserted.
CREATE OR REPLACE FUNCTION public.notify_new_order_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://ktqdnsbdgngobqmxasnv.supabase.co/functions/v1/notify-new-order';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0cWRuc2JkZ25nb2JxbXhhc252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzY3NTYsImV4cCI6MjA5Mjk1Mjc1Nn0._1KH9wZmibA0svnGAMz1jYyZWVLmg9Rapz-3wG-zhns';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_new_order_email failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order_email();