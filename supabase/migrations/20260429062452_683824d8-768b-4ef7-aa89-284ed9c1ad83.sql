-- 1. Profile additions: presence + restriction + whatsapp
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS is_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restriction_reason text;

-- 2. WhatsApp on vendor applications
ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 3. Complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_seller ON public.complaints(seller_id);
CREATE INDEX IF NOT EXISTS idx_complaints_buyer ON public.complaints(buyer_id);
CREATE INDEX IF NOT EXISTS idx_complaints_order ON public.complaints(order_id);

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "complaints_admin_all" ON public.complaints
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "complaints_party_select" ON public.complaints
  FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin(auth.uid()));

-- 4. Presence functions
CREATE OR REPLACE FUNCTION public.update_my_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.is_user_online(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT last_seen_at > now() - interval '2 minutes' FROM public.profiles WHERE id = _user_id), false);
$$;

-- 5. File complaint function (buyer only, while order/plan still active)
CREATE OR REPLACE FUNCTION public.file_complaint(_order_id uuid, _reason text, _details text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _id uuid;
  _uid uuid := auth.uid();
  _expired boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.buyer_id <> _uid THEN RAISE EXCEPTION 'Only the buyer can file a complaint'; END IF;

  -- Check plan not expired (if tier_label looks like "1 Month" / "30 Days" etc., compare against credentials_sent_at or created_at)
  -- Simple rule: complaint allowed within 60 days of order creation OR while order isn't completed for >60 days
  IF _o.created_at < now() - interval '60 days' THEN
    _expired := true;
  END IF;
  IF _expired THEN RAISE EXCEPTION 'Plan window has expired, complaint no longer allowed'; END IF;

  -- Prevent duplicate open complaint for same order
  IF EXISTS (SELECT 1 FROM public.complaints WHERE order_id = _order_id AND buyer_id = _uid AND status = 'open') THEN
    RAISE EXCEPTION 'You already have an open complaint on this order';
  END IF;

  INSERT INTO public.complaints (order_id, buyer_id, seller_id, reason, details)
  VALUES (_order_id, _uid, _o.seller_id, trim(_reason), NULLIF(trim(coalesce(_details,'')), ''))
  RETURNING id INTO _id;

  -- Restrict seller: block listings + withdrawals, deactivate current listings
  UPDATE public.profiles
    SET is_restricted = true,
        restriction_reason = COALESCE(restriction_reason, 'Buyer complaint pending review')
    WHERE id = _o.seller_id;

  UPDATE public.products
    SET is_active = false, updated_at = now()
    WHERE seller_id = _o.seller_id AND is_active = true;

  RETURN _id;
END $$;

-- 6. Admin clears restriction
CREATE OR REPLACE FUNCTION public.admin_clear_seller_restriction(_seller_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles
    SET is_restricted = false, restriction_reason = NULL
    WHERE id = _seller_id;
  UPDATE public.complaints
    SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), resolution_note = _note
    WHERE seller_id = _seller_id AND status = 'open';
END $$;

-- 7. Block restricted sellers from creating new listings (insert policy override)
DROP POLICY IF EXISTS "products_seller_insert" ON public.products;
CREATE POLICY "products_seller_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND public.has_role(auth.uid(), 'seller'::app_role)
    AND NOT COALESCE((SELECT is_restricted FROM public.profiles WHERE id = auth.uid()), false)
  );

-- 8. Block restricted sellers from withdrawals — guard inside request_withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _upi_id text, _qr_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _bal NUMERIC; _id UUID; _user UUID := auth.uid(); _restricted BOOLEAN;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_restricted INTO _restricted FROM public.profiles WHERE id = _user;
  IF COALESCE(_restricted, false) THEN
    RAISE EXCEPTION 'Withdrawals are blocked due to a pending complaint. Contact admin.';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _upi_id IS NULL OR length(trim(_upi_id)) < 4 THEN RAISE EXCEPTION 'Valid UPI ID required'; END IF;
  IF _qr_path IS NULL OR length(_qr_path) = 0 THEN RAISE EXCEPTION 'UPI QR screenshot required'; END IF;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF COALESCE(_bal,0) < _amount THEN RAISE EXCEPTION 'Insufficient withdrawable balance'; END IF;

  UPDATE public.wallets
    SET balance = balance - _amount,
        pending_balance = pending_balance + _amount,
        updated_at = now()
    WHERE user_id = _user;

  INSERT INTO public.withdrawals (seller_id, amount, upi_id, qr_screenshot_path)
    VALUES (_user, _amount, trim(_upi_id), _qr_path)
    RETURNING id INTO _id;

  RETURN _id;
END $function$;

-- Allow public read of online status (no PII): expose limited columns via existing select policy is fine
-- profiles already restricts SELECT to self/admin. We add a small public RPC to check online without exposing the table:
GRANT EXECUTE ON FUNCTION public.is_user_online(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.file_complaint(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_seller_restriction(uuid, text) TO authenticated;