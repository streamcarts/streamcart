-- Email delivery log for admin panel
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  recipient text NOT NULL,
  subject text NOT NULL,
  type text,
  status text NOT NULL CHECK (status IN ('sent','failed','retry')),
  attempt int NOT NULL DEFAULT 1,
  provider_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_logs_created_idx ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON public.email_logs (status);
CREATE INDEX IF NOT EXISTS email_logs_notif_idx ON public.email_logs (notification_id);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
CREATE POLICY "Admins can view email logs"
ON public.email_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));