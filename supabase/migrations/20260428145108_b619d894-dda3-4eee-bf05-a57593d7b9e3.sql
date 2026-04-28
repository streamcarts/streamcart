
-- 1. Schema additions
ALTER TABLE public.pending_orders
  ADD COLUMN IF NOT EXISTS txn_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  ADD COLUMN IF NOT EXISTS auto_match_score INT NOT NULL DEFAULT 0;

-- Case-insensitive unique txn_id (only when not null) to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS pending_orders_txn_id_uniq
  ON public.pending_orders (lower(txn_id))
  WHERE txn_id IS NOT NULL;

-- Mark expired orders as 'expired' status; allow new status value
-- (status is text, so no enum change needed)

-- 2. Auto-cancel function
CREATE OR REPLACE FUNCTION public.cancel_expired_pending_orders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n INT;
BEGIN
  WITH upd AS (
    UPDATE public.pending_orders
       SET status = 'expired', updated_at = now(),
           admin_note = COALESCE(admin_note, 'Auto-cancelled: no payment proof in time')
     WHERE status = 'pending'
       AND expires_at < now()
       AND screenshot_path IS NULL OR screenshot_path = ''
    RETURNING 1
  )
  SELECT count(*) INTO _n FROM upd;
  RETURN _n;
END $$;

-- 3. Submission RPC: validates fraud rules + uniqueness atomically
CREATE OR REPLACE FUNCTION public.submit_pending_order(
  _amount NUMERIC,
  _txn_id TEXT,
  _screenshot_path TEXT,
  _items JSONB,
  _coupon_code TEXT DEFAULT NULL,
  _affiliate_slug TEXT DEFAULT NULL,
  _upi_reference TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Limit active pending orders per buyer (max 3)
  SELECT count(*) INTO _active_count
    FROM public.pending_orders
   WHERE buyer_id = _buyer AND status = 'pending';
  IF _active_count >= 3 THEN
    RAISE EXCEPTION 'You already have 3 pending orders awaiting verification. Please wait or cancel one.';
  END IF;

  -- Duplicate txn id check (across all users)
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
    _coupon_code, _affiliate_slug, now() + interval '30 minutes'
  ) RETURNING id INTO _id;

  RETURN _id;
END $$;

-- 4. User-facing cancel (buyer can cancel their own pending order)
CREATE OR REPLACE FUNCTION public.cancel_my_pending_order(_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pending_orders
     SET status = 'cancelled', updated_at = now(),
         admin_note = COALESCE(admin_note, 'Cancelled by user')
   WHERE id = _id AND buyer_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot cancel'; END IF;
END $$;
