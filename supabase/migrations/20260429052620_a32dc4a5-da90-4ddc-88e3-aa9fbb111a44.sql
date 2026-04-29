-- =========================================================
-- Enable scheduling extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- request_withdrawal: deduct balance immediately into pending_balance
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _upi_id text, _qr_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _bal NUMERIC; _id UUID; _user UUID := auth.uid();
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF _upi_id IS NULL OR length(trim(_upi_id)) < 4 THEN RAISE EXCEPTION 'Valid UPI ID required'; END IF;
  IF _qr_path IS NULL OR length(_qr_path) = 0 THEN RAISE EXCEPTION 'UPI QR screenshot required'; END IF;

  -- Lock wallet row
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF COALESCE(_bal,0) < _amount THEN RAISE EXCEPTION 'Insufficient withdrawable balance'; END IF;

  -- Deduct immediately and move to pending_balance (hold)
  UPDATE public.wallets
    SET balance = balance - _amount,
        pending_balance = pending_balance + _amount,
        updated_at = now()
    WHERE user_id = _user;

  INSERT INTO public.withdrawals (seller_id, amount, upi_id, qr_screenshot_path)
    VALUES (_user, _amount, trim(_upi_id), _qr_path)
    RETURNING id INTO _id;

  RETURN _id;
END $$;

-- =========================================================
-- approve_withdrawal: balance was already deducted on request, just clear hold
-- =========================================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal(_wd_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Invalid withdrawal'; END IF;

  -- Release the hold (funds were deducted at request time)
  UPDATE public.wallets
    SET pending_balance = GREATEST(0, pending_balance - _w.amount),
        updated_at = now()
    WHERE user_id = _w.seller_id;

  UPDATE public.withdrawals SET status='approved', reviewed_at=now() WHERE id=_wd_id;
END $$;

-- =========================================================
-- reject_withdrawal: refund the held amount back to balance
-- =========================================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal(_wd_id uuid, _note text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _w FROM public.withdrawals WHERE id = _wd_id FOR UPDATE;
  IF NOT FOUND OR _w.status <> 'pending' THEN RAISE EXCEPTION 'Invalid withdrawal'; END IF;

  -- Return the held funds to the seller's balance
  UPDATE public.wallets
    SET balance = balance + _w.amount,
        pending_balance = GREATEST(0, pending_balance - _w.amount),
        updated_at = now()
    WHERE user_id = _w.seller_id;

  UPDATE public.withdrawals
    SET status='rejected', reviewed_at=now(), admin_note=_note
    WHERE id=_wd_id;
END $$;

-- =========================================================
-- issue_refund: extra guard against refunding cancelled/expired
-- =========================================================
CREATE OR REPLACE FUNCTION public.issue_refund(_order_id uuid, _reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _o public.orders%ROWTYPE; _refund_id UUID; _admin UUID := auth.uid(); _hold RECORD;
BEGIN
  IF NOT public.is_admin(_admin) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status = 'refunded' THEN RAISE EXCEPTION 'Already refunded'; END IF;

  -- Credit buyer back the full paid amount
  UPDATE public.wallets SET balance = balance + _o.total_paid, updated_at = now() WHERE user_id = _o.buyer_id;

  -- Reverse seller earning: if still on hold, just cancel the hold; otherwise debit wallet
  FOR _hold IN
    SELECT id, user_id, amount FROM public.earnings_holds
      WHERE order_id = _o.id AND status = 'holding' FOR UPDATE
  LOOP
    UPDATE public.wallets
      SET pending_balance = GREATEST(0, pending_balance - _hold.amount),
          updated_at = now()
      WHERE user_id = _hold.user_id;
    UPDATE public.earnings_holds
      SET status = 'released', released_at = now()
      WHERE id = _hold.id;
  END LOOP;

  -- If no hold existed (already released), debit seller directly
  IF NOT EXISTS (SELECT 1 FROM public.earnings_holds WHERE order_id = _o.id) THEN
    UPDATE public.wallets SET balance = balance - _o.seller_earning, updated_at = now() WHERE user_id = _o.seller_id;
  END IF;

  -- Free credential back to pool if attached
  IF _o.credential_id IS NOT NULL THEN
    UPDATE public.product_credentials SET status = 'available', assigned_order_id = NULL, assigned_at = NULL WHERE id = _o.credential_id;
  END IF;

  UPDATE public.orders SET status = 'refunded' WHERE id = _o.id;

  -- Close any chat thread
  UPDATE public.order_chats SET status = 'cancelled', updated_at = now() WHERE order_id = _o.id AND status NOT IN ('completed','cancelled');

  INSERT INTO public.refunds (order_id, buyer_id, seller_id, amount, reason, status, processed_by)
  VALUES (_o.id, _o.buyer_id, _o.seller_id, _o.total_paid, _reason, 'processed', _admin)
  RETURNING id INTO _refund_id;

  RETURN _refund_id;
END $$;

-- =========================================================
-- Cron: cleanup jobs (idempotent — unschedule then re-schedule)
-- =========================================================
DO $$
DECLARE _job RECORD;
BEGIN
  FOR _job IN SELECT jobname FROM cron.job WHERE jobname IN (
    'streamcart-expire-pending-orders',
    'streamcart-auto-complete-chat-orders',
    'streamcart-release-earnings-holds'
  ) LOOP
    PERFORM cron.unschedule(_job.jobname);
  END LOOP;
END $$;

SELECT cron.schedule(
  'streamcart-expire-pending-orders',
  '*/2 * * * *',
  $$ SELECT public.cancel_expired_pending_orders(); $$
);

SELECT cron.schedule(
  'streamcart-auto-complete-chat-orders',
  '*/5 * * * *',
  $$ SELECT public.auto_complete_chat_orders(); $$
);

SELECT cron.schedule(
  'streamcart-release-earnings-holds',
  '*/5 * * * *',
  $$ SELECT public.release_due_earnings(); $$
);