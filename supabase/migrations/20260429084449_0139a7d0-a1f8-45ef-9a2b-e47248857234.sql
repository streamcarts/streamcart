-- Auto-send email via edge function whenever a notification is inserted
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trg_send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ktqdnsbdgngobqmxasnv.supabase.co/functions/v1/send-notification-email',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block insert if email dispatch fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_email_dispatch ON public.notifications;
CREATE TRIGGER notifications_email_dispatch
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trg_send_notification_email();