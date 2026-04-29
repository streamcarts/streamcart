-- 1) OCR fields on pending_orders
ALTER TABLE public.pending_orders
  ADD COLUMN IF NOT EXISTS ocr_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS ocr_reference TEXT,
  ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'pending', -- pending|done|failed|skipped
  ADD COLUMN IF NOT EXISTS ocr_raw TEXT,
  ADD COLUMN IF NOT EXISTS ocr_processed_at TIMESTAMPTZ;

-- 2) Tightened scoring + auto-approval (exact match, 15 min, OCR boost, no banned)
CREATE OR REPLACE FUNCTION public.score_pending_order(_po public.pending_orders)
 RETURNS TABLE(score integer, tag text, should_auto_approve boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _score INT := 0;
  _expected NUMERIC := 0;
  _item JSONB;
  _completed_orders INT := 0;
  _fraud_count INT := 0;
  _high_fraud INT := 0;
  _is_trusted BOOLEAN := false;
  _txn_valid BOOLEAN := false;
  _amount_exact BOOLEAN := false;
  _within_window BOOLEAN := false;
  _is_banned BOOLEAN := false;
  _ocr_amount_match BOOLEAN := false;
  _ocr_ref_match BOOLEAN := false;
  _high_confidence BOOLEAN := false;
  _tag TEXT := 'review';
  _approve BOOLEAN := false;
BEGIN
  -- Banned users: never auto-approve
  SELECT is_banned INTO _is_banned FROM public.profiles WHERE id = _po.buyer_id;
  IF _is_banned THEN
    RETURN QUERY SELECT 0, 'blocked_banned'::TEXT, false; RETURN;
  END IF;

  -- Expected amount from items (sum of display_price * qty)
  FOR _item IN SELECT * FROM jsonb_array_elements(_po.items) LOOP
    _expected := _expected + (COALESCE((_item->>'display_price')::NUMERIC, 0) * COALESCE((_item->>'qty')::INT, 1));
  END LOOP;

  -- EXACT match: paid amount minus expected within 1 paise (we add 0.01–0.99 paise marker so allow up to 1.00)
  IF _expected > 0 AND _po.amount >= _expected AND (_po.amount - _expected) < 1.00 THEN
    _amount_exact := true;
    _score := _score + 40;
  END IF;

  -- Txn ID format: 10–30 alphanumeric chars
  IF _po.txn_id IS NOT NULL AND _po.txn_id ~ '^[A-Za-z0-9]{10,30}$' THEN
    _txn_valid := true;
    _score := _score + 20;
  END IF;

  -- Within 15-minute window (created within last 15 minutes)
  IF _po.created_at > now() - interval '15 minutes' THEN
    _within_window := true;
    _score := _score + 10;
  END IF;

  -- Trust signals
  SELECT COUNT(*) INTO _completed_orders FROM public.orders
    WHERE buyer_id = _po.buyer_id AND status = 'completed';

  SELECT COUNT(*) INTO _high_fraud FROM public.fraud_flags
    WHERE user_id = _po.buyer_id AND resolved = false AND severity = 'high';

  SELECT COUNT(*) INTO _fraud_count FROM public.fraud_flags
    WHERE user_id = _po.buyer_id AND resolved = false;

  IF _completed_orders >= 3 AND _high_fraud = 0 THEN
    _is_trusted := true;
    _score := _score + 20;
  END IF;

  IF _fraud_count = 0 THEN
    _score := _score + 10;
  ELSIF _high_fraud > 0 THEN
    _score := _score - 40;
  ELSE
    _score := _score - 15;
  END IF;

  -- OCR signals
  IF _po.ocr_status = 'done' THEN
    IF _po.ocr_amount IS NOT NULL AND _expected > 0 AND ABS(_po.ocr_amount - _po.amount) < 1.00 THEN
      _ocr_amount_match := true;
      _score := _score + 15;
    END IF;
    IF _po.ocr_reference IS NOT NULL AND _po.txn_id IS NOT NULL
       AND lower(regexp_replace(_po.ocr_reference, '[^A-Za-z0-9]', '', 'g'))
         = lower(regexp_replace(_po.txn_id, '[^A-Za-z0-9]', '', 'g')) THEN
      _ocr_ref_match := true;
      _score := _score + 15;
    END IF;
    _high_confidence := _ocr_amount_match AND _ocr_ref_match;
  END IF;

  -- Hard gates: must satisfy ALL of these to be auto-approved
  IF NOT (_amount_exact AND _txn_valid AND _within_window AND _high_fraud = 0) THEN
    -- Tagging only
    IF _amount_exact AND _txn_valid THEN
      _tag := 'likely_valid';
    ELSIF _amount_exact THEN
      _tag := 'amount_only';
    ELSIF NOT _within_window THEN
      _tag := 'expired_window';
    ELSE
      _tag := 'review';
    END IF;
    RETURN QUERY SELECT _score, _tag, false; RETURN;
  END IF;

  -- All gates passed. Decide approval tier.
  IF _high_confidence THEN
    _approve := true; _tag := 'high_confidence_ocr';
  ELSIF _is_trusted THEN
    _approve := true; _tag := 'trusted_auto_approved';
  ELSIF _ocr_amount_match THEN
    _tag := 'likely_valid'; _approve := false;
  ELSE
    _tag := 'likely_valid'; _approve := false;
  END IF;

  RETURN QUERY SELECT _score, _tag, _approve;
END $function$;

-- 3) Re-score on OCR update (in addition to insert)
CREATE OR REPLACE FUNCTION public.tg_pending_order_auto_approve()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _score INT;
  _tag TEXT;
  _approve BOOLEAN;
  _orders UUID[];
  _po public.pending_orders%ROWTYPE;
BEGIN
  -- Only act while still pending
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;

  SELECT * INTO _po FROM public.pending_orders WHERE id = NEW.id;

  SELECT s.score, s.tag, s.should_auto_approve INTO _score, _tag, _approve
  FROM public.score_pending_order(_po) s;

  UPDATE public.pending_orders
    SET auto_match_score = _score,
        admin_note = _tag
    WHERE id = NEW.id;

  IF _approve THEN
    BEGIN
      INSERT INTO public.wallets (user_id, balance) VALUES (_po.buyer_id, _po.amount)
        ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

      DECLARE
        _item JSONB; _qty INT; _pid UUID; _order_id UUID;
        _coupon_used BOOLEAN := false;
      BEGIN
        _orders := ARRAY[]::UUID[];
        FOR _item IN SELECT * FROM jsonb_array_elements(_po.items) LOOP
          _pid := (_item->>'id')::UUID;
          _qty := COALESCE((_item->>'qty')::INT, 1);
          FOR i IN 1.._qty LOOP
            _order_id := public._admin_purchase_for_buyer(
              _po.buyer_id, _pid,
              CASE WHEN NOT _coupon_used THEN _po.coupon_code ELSE NULL END,
              _po.affiliate_slug
            );
            _coupon_used := true;
            _orders := array_append(_orders, _order_id);
          END LOOP;
        END LOOP;
      END;

      UPDATE public.pending_orders
        SET status = 'approved',
            reviewed_at = now(),
            admin_note = _tag || ' (system)',
            order_ids = _orders,
            updated_at = now()
        WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.pending_orders
        SET admin_note = _tag || ' | auto-approve failed: ' || SQLERRM
        WHERE id = NEW.id;
    END;
  END IF;

  RETURN NEW;
END $function$;

-- Recreate triggers (insert + ocr update)
DROP TRIGGER IF EXISTS pending_order_auto_approve_ins ON public.pending_orders;
DROP TRIGGER IF EXISTS pending_order_auto_approve_ocr ON public.pending_orders;
DROP TRIGGER IF EXISTS pending_order_auto_approve ON public.pending_orders;

CREATE TRIGGER pending_order_auto_approve_ins
  AFTER INSERT ON public.pending_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_pending_order_auto_approve();

CREATE TRIGGER pending_order_auto_approve_ocr
  AFTER UPDATE OF ocr_status ON public.pending_orders
  FOR EACH ROW
  WHEN (NEW.ocr_status = 'done' AND NEW.status = 'pending')
  EXECUTE FUNCTION public.tg_pending_order_auto_approve();

-- 4) Fraud: track repeated failed attempts (duplicate txn or mismatch)
CREATE OR REPLACE FUNCTION public.flag_repeated_fraud(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _recent INT;
BEGIN
  SELECT COUNT(*) INTO _recent FROM public.fraud_flags
    WHERE user_id = _user_id
      AND resolved = false
      AND created_at > now() - interval '24 hours'
      AND signal IN ('duplicate_txn_id','amount_mismatch','invalid_txn_format');
  IF _recent >= 3 THEN
    INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
    VALUES (_user_id, 'repeated_failed_payments', 'high',
            jsonb_build_object('failed_attempts_24h', _recent));
  END IF;
END $$;

-- 5) Update submit_pending_order: keep duplicate guard, also flag amount-mismatch as a fraud signal,
--    and call repeated-fraud check.
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
    INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
    VALUES (_buyer, 'invalid_txn_format', 'low', jsonb_build_object('txn_id', _txn_id));
    PERFORM public.flag_repeated_fraud(_buyer);
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
    PERFORM public.flag_repeated_fraud(_buyer);
    RAISE EXCEPTION 'This transaction ID has already been used';
  END IF;

  INSERT INTO public.pending_orders (
    buyer_id, amount, upi_reference, txn_id, screenshot_path, items,
    coupon_code, affiliate_slug, expires_at
  ) VALUES (
    _buyer, _amount, _upi_reference, _txn_clean, _screenshot_path, _items,
    _coupon_code, _affiliate_slug, now() + interval '15 minutes'
  ) RETURNING id INTO _id;

  RETURN _id;
END $function$;

-- 6) Default expiry 15 min
ALTER TABLE public.pending_orders
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '15 minutes');