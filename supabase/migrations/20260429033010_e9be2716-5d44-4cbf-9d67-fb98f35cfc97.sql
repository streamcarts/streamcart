-- Smart auto-approval scoring + trigger for pending_orders

CREATE OR REPLACE FUNCTION public.score_pending_order(_po public.pending_orders)
RETURNS TABLE(score INT, tag TEXT, should_auto_approve BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _score INT := 0;
  _expected NUMERIC := 0;
  _item JSONB;
  _completed_orders INT := 0;
  _fraud_count INT := 0;
  _is_trusted BOOLEAN := false;
  _txn_valid BOOLEAN := false;
  _amount_match BOOLEAN := false;
  _hour_ist INT;
  _is_night BOOLEAN;
  _tag TEXT := 'review';
  _approve BOOLEAN := false;
BEGIN
  -- Expected amount from items
  FOR _item IN SELECT * FROM jsonb_array_elements(_po.items) LOOP
    _expected := _expected + (COALESCE((_item->>'display_price')::NUMERIC, 0) * COALESCE((_item->>'qty')::INT, 1));
  END LOOP;

  IF _expected > 0 AND ABS(_po.amount - _expected) < 0.5 THEN
    _amount_match := true;
    _score := _score + 40;
  END IF;

  -- Txn ID format: at least 10 alphanumeric chars
  IF _po.txn_id IS NOT NULL AND _po.txn_id ~ '^[A-Za-z0-9]{10,}$' THEN
    _txn_valid := true;
    _score := _score + 20;
  END IF;

  -- Trusted user: 3+ completed orders, no high-severity fraud
  SELECT COUNT(*) INTO _completed_orders FROM public.orders
    WHERE buyer_id = _po.buyer_id AND status = 'completed';

  SELECT COUNT(*) INTO _fraud_count FROM public.fraud_flags
    WHERE user_id = _po.buyer_id AND resolved = false AND severity IN ('high', 'medium');

  IF _completed_orders >= 3 AND _fraud_count = 0 THEN
    _is_trusted := true;
    _score := _score + 30;
  END IF;

  IF _fraud_count = 0 THEN
    _score := _score + 10;
  ELSE
    _score := _score - 20;
  END IF;

  -- Night mode (IST = UTC+5:30): 23:00–08:00
  _hour_ist := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Asia/Kolkata'))::INT;
  _is_night := (_hour_ist >= 23 OR _hour_ist < 8);

  -- Decide tag + auto-approve
  IF _is_night THEN
    IF _score >= 90 THEN _approve := true; _tag := 'auto_approved_night';
    ELSIF _score >= 60 THEN _tag := 'likely_valid_night_hold';
    ELSE _tag := 'review';
    END IF;
  ELSE
    IF _is_trusted AND _amount_match AND _txn_valid THEN
      _approve := true; _tag := 'trusted_auto_approved';
    ELSIF _score >= 70 AND _amount_match AND _txn_valid THEN
      _approve := true; _tag := 'auto_approved';
    ELSIF _score >= 50 AND _amount_match THEN
      _tag := 'likely_valid';
    ELSE
      _tag := 'review';
    END IF;
  END IF;

  RETURN QUERY SELECT _score, _tag, _approve;
END $$;

-- Trigger: score + maybe auto-approve right after insert
CREATE OR REPLACE FUNCTION public.tg_pending_order_auto_approve()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _score INT;
  _tag TEXT;
  _approve BOOLEAN;
  _orders UUID[];
  _po public.pending_orders%ROWTYPE;
BEGIN
  SELECT * INTO _po FROM public.pending_orders WHERE id = NEW.id;

  SELECT s.score, s.tag, s.should_auto_approve INTO _score, _tag, _approve
  FROM public.score_pending_order(_po) s;

  UPDATE public.pending_orders
    SET auto_match_score = _score,
        admin_note = _tag
    WHERE id = NEW.id;

  IF _approve THEN
    BEGIN
      -- Inline auto-approval (mirrors approve_pending_order without admin check)
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
      -- If auto-approval fails, leave as pending for admin
      UPDATE public.pending_orders
        SET admin_note = _tag || ' | auto-approve failed: ' || SQLERRM
        WHERE id = NEW.id;
    END;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS pending_order_auto_approve ON public.pending_orders;
CREATE TRIGGER pending_order_auto_approve
  AFTER INSERT ON public.pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pending_order_auto_approve();