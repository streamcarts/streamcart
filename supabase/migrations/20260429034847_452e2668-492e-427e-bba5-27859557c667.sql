-- Tighten pending order expiry to 10 minutes (was 30) and default column too
ALTER TABLE public.pending_orders
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');

CREATE OR REPLACE FUNCTION public.submit_pending_order(_amount numeric, _txn_id text, _screenshot_path text, _items jsonb, _coupon_code text DEFAULT NULL::text, _affiliate_slug text DEFAULT NULL::text, _upi_reference text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _buyer UUID := auth.uid();
  _id UUID;
  _active_count INT;
  _is_banned BOOLEAN;
  _txn_clean TEXT;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _screenshot_path IS NULL OR length(_screenshot_path) = 0 THEN
    RAISE EXCEPTION 'Screenshot required';
  END IF;
  IF _txn_id IS NULL OR length(trim(_txn_id)) < 6 THEN
    RAISE EXCEPTION 'Valid UPI transaction ID required (min 6 chars)';
  END IF;
  _txn_clean := trim(_txn_id);

  SELECT is_banned INTO _is_banned FROM public.profiles WHERE id = _buyer;
  IF _is_banned THEN RAISE EXCEPTION 'Account suspended'; END IF;

  SELECT count(*) INTO _active_count
    FROM public.pending_orders
   WHERE buyer_id = _buyer AND status = 'pending';
  IF _active_count >= 3 THEN
    RAISE EXCEPTION 'You already have 3 pending orders awaiting verification. Please wait or cancel one.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pending_orders WHERE lower(txn_id) = lower(_txn_clean)) THEN
    INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
    VALUES (_buyer, 'duplicate_txn_id', 'high', jsonb_build_object('txn_id', _txn_clean));
    RAISE EXCEPTION 'This transaction ID has already been used';
  END IF;

  INSERT INTO public.pending_orders (
    buyer_id, amount, upi_reference, txn_id, screenshot_path, items,
    coupon_code, affiliate_slug, expires_at
  ) VALUES (
    _buyer, _amount, _upi_reference, _txn_clean, _screenshot_path, _items,
    _coupon_code, _affiliate_slug, now() + interval '10 minutes'
  ) RETURNING id INTO _id;

  RETURN _id;
END $function$;