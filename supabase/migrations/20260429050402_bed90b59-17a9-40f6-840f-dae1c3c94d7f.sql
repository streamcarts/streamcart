-- ============== PRODUCTS: extend for chat-delivery listings ==============
DO $$ BEGIN
  CREATE TYPE public.delivery_mode AS ENUM ('instant','chat');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS delivery_mode public.delivery_mode NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS device_logins INTEGER,
  ADD COLUMN IF NOT EXISTS device_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_private_account BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_tiers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- For chat-delivery products credentials columns must be optional
ALTER TABLE public.products
  ALTER COLUMN credentials_email DROP NOT NULL,
  ALTER COLUMN credentials_password DROP NOT NULL;

-- ============== ORDERS: extend for chat delivery ==============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_mode public.delivery_mode NOT NULL DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS chat_id UUID,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tier_label TEXT;

-- Make credentials nullable on orders too (chat orders start empty)
ALTER TABLE public.orders
  ALTER COLUMN credentials_email DROP NOT NULL,
  ALTER COLUMN credentials_password DROP NOT NULL;

-- ============== ORDER CHATS ==============
CREATE TABLE IF NOT EXISTS public.order_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_delivery',
    -- pending_delivery | delivered | completed | disputed | cancelled
  response_due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  auto_complete_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY chats_admin_all ON public.order_chats
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY chats_party_select ON public.order_chats
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- ============== CHAT MESSAGES ==============
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.order_chats(id) ON DELETE CASCADE,
  sender_id UUID,
  kind TEXT NOT NULL DEFAULT 'text', -- text | credentials | system
  body TEXT,
  cred_email TEXT,
  cred_password TEXT,
  cred_notes TEXT,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON public.chat_messages(chat_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY cmsg_admin_all ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY cmsg_party_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.order_chats c
    WHERE c.id = chat_messages.chat_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
  ));

-- No direct insert by clients — use RPCs (send_chat_message / send_chat_credentials / mark_order_received)
-- so contact-info detection runs server-side.

-- ============== SELLER FLAGS ==============
CREATE TABLE IF NOT EXISTS public.seller_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  message_id UUID,
  chat_id UUID,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  message_preview TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_flags_seller ON public.seller_flags(seller_id, resolved, created_at DESC);

ALTER TABLE public.seller_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY sflag_admin_all ON public.seller_flags
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY sflag_self_select ON public.seller_flags
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============== Contact-info detector ==============
CREATE OR REPLACE FUNCTION public.detect_contact_info(_text TEXT)
RETURNS TABLE(found BOOLEAN, reason TEXT)
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE _norm TEXT;
BEGIN
  IF _text IS NULL OR length(_text) = 0 THEN
    RETURN QUERY SELECT false, NULL::TEXT; RETURN;
  END IF;
  _norm := lower(_text);
  -- 10-digit phone (with optional spaces / dashes / leading +91)
  IF regexp_replace(_text, '[^0-9]', '', 'g') ~ '[0-9]{10,}' THEN
    RETURN QUERY SELECT true, 'phone_number'::TEXT; RETURN;
  END IF;
  -- email
  IF _norm ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' THEN
    RETURN QUERY SELECT true, 'email_address'::TEXT; RETURN;
  END IF;
  -- contact keywords
  IF _norm ~ '(whats[\s\-]?app|telegram|t\.me/|insta(gram)?|snapchat|signal app|wechat|contact me|dm me|message me on|call me|my number|mera number|gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)' THEN
    RETURN QUERY SELECT true, 'contact_keyword'::TEXT; RETURN;
  END IF;
  -- bare URLs
  IF _norm ~ '(https?://|www\.)' THEN
    RETURN QUERY SELECT true, 'external_link'::TEXT; RETURN;
  END IF;
  RETURN QUERY SELECT false, NULL::TEXT;
END $$;

-- ============== RPC: open chat for an existing order (idempotent) ==============
CREATE OR REPLACE FUNCTION public.ensure_order_chat(_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _o public.orders%ROWTYPE; _chat_id UUID;
BEGIN
  SELECT * INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.buyer_id <> auth.uid() AND _o.seller_id <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT id INTO _chat_id FROM public.order_chats WHERE order_id = _order_id;
  IF _chat_id IS NULL THEN
    INSERT INTO public.order_chats (order_id, buyer_id, seller_id, status, response_due_at)
    VALUES (_order_id, _o.buyer_id, _o.seller_id, 'pending_delivery', now() + interval '30 minutes')
    RETURNING id INTO _chat_id;
    UPDATE public.orders SET chat_id = _chat_id WHERE id = _order_id;
    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
    VALUES (_chat_id, NULL, 'system',
      'Order created. Seller will deliver credentials in this chat. Sharing phone, email, WhatsApp, Telegram or external links is strictly prohibited.');
  END IF;
  RETURN _chat_id;
END $$;

-- ============== RPC: send a normal chat message (with detection) ==============
CREATE OR REPLACE FUNCTION public.send_chat_message(_chat_id UUID, _body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _chat public.order_chats%ROWTYPE;
  _uid UUID := auth.uid();
  _det RECORD;
  _msg_id UUID;
  _is_seller BOOLEAN;
  _flag_count INT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'Message empty'; END IF;
  IF length(_body) > 2000 THEN RAISE EXCEPTION 'Message too long'; END IF;

  SELECT * INTO _chat FROM public.order_chats WHERE id = _chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF _uid <> _chat.buyer_id AND _uid <> _chat.seller_id THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  IF _chat.status IN ('cancelled') THEN RAISE EXCEPTION 'Chat closed'; END IF;

  _is_seller := (_uid = _chat.seller_id);

  SELECT * INTO _det FROM public.detect_contact_info(_body);

  IF _det.found THEN
    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body, is_flagged, flag_reason, is_blocked)
    VALUES (_chat_id, _uid, 'text',
      '⚠️ Message blocked: sharing contact information is not allowed on StreamCart.',
      true, _det.reason, true)
    RETURNING id INTO _msg_id;

    -- Only flag the SELLER (sellers must not leak buyer outside)
    IF _is_seller THEN
      INSERT INTO public.seller_flags (seller_id, message_id, chat_id, reason, severity, message_preview)
      VALUES (_uid, _msg_id, _chat_id, _det.reason, 'high', left(_body, 200));

      -- Auto-ban seller after 3+ unresolved high-severity flags
      SELECT count(*) INTO _flag_count FROM public.seller_flags
        WHERE seller_id = _uid AND resolved = false AND severity = 'high';
      IF _flag_count >= 3 THEN
        UPDATE public.profiles SET is_banned = true,
          ban_reason = COALESCE(ban_reason, 'Auto-ban: contact-info sharing in chat')
          WHERE id = _uid;
      END IF;
    ELSE
      -- Buyer side: still warn but no seller flag
      INSERT INTO public.fraud_flags (user_id, signal, severity, metadata)
      VALUES (_uid, 'buyer_contact_share_attempt', 'low',
              jsonb_build_object('chat_id', _chat_id, 'reason', _det.reason));
    END IF;

    RETURN _msg_id;
  END IF;

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
  VALUES (_chat_id, _uid, 'text', _body)
  RETURNING id INTO _msg_id;

  UPDATE public.order_chats SET updated_at = now() WHERE id = _chat_id;
  RETURN _msg_id;
END $$;

-- ============== RPC: seller sends structured credentials ==============
CREATE OR REPLACE FUNCTION public.send_chat_credentials(
  _chat_id UUID, _email TEXT, _password TEXT, _notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _chat public.order_chats%ROWTYPE;
  _uid UUID := auth.uid();
  _msg_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _email IS NULL OR length(trim(_email)) = 0 THEN RAISE EXCEPTION 'Email/username required'; END IF;
  IF _password IS NULL OR length(trim(_password)) = 0 THEN RAISE EXCEPTION 'Password required'; END IF;

  SELECT * INTO _chat FROM public.order_chats WHERE id = _chat_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chat not found'; END IF;
  IF _uid <> _chat.seller_id THEN RAISE EXCEPTION 'Only the seller can deliver credentials'; END IF;
  IF _chat.status NOT IN ('pending_delivery','delivered') THEN
    RAISE EXCEPTION 'Order is %', _chat.status;
  END IF;

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, cred_email, cred_password, cred_notes, body)
  VALUES (_chat_id, _uid, 'credentials', _email, _password, NULLIF(trim(coalesce(_notes,'')), ''),
          'Credentials delivered. Please test and click "Mark as Received".')
  RETURNING id INTO _msg_id;

  UPDATE public.order_chats
    SET status = 'delivered',
        delivered_at = COALESCE(delivered_at, now()),
        auto_complete_at = COALESCE(auto_complete_at, now() + interval '24 hours'),
        updated_at = now()
    WHERE id = _chat_id;

  UPDATE public.orders
    SET credentials_email = _email,
        credentials_password = _password,
        credentials_sent_at = now()
    WHERE id = _chat.order_id;

  RETURN _msg_id;
END $$;

-- ============== RPC: buyer marks order received ==============
CREATE OR REPLACE FUNCTION public.mark_order_received(_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _o public.orders%ROWTYPE;
  _uid UUID := auth.uid();
  _hold RECORD;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _uid <> _o.buyer_id AND NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Only buyer can confirm';
  END IF;
  IF _o.status = 'completed' AND _o.received_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.orders SET status = 'completed', received_at = now() WHERE id = _o.id;

  UPDATE public.order_chats
    SET status = 'completed', completed_at = now(), updated_at = now()
    WHERE order_id = _o.id;

  -- Insert system message
  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
  SELECT id, NULL, 'system', 'Buyer confirmed delivery. Order completed.'
  FROM public.order_chats WHERE order_id = _o.id;

  -- Release any earnings hold immediately for this order
  FOR _hold IN
    SELECT id, user_id, amount FROM public.earnings_holds
      WHERE order_id = _o.id AND status = 'holding' FOR UPDATE
  LOOP
    UPDATE public.wallets
      SET balance = balance + _hold.amount,
          pending_balance = GREATEST(0, pending_balance - _hold.amount),
          updated_at = now()
      WHERE user_id = _hold.user_id;
    UPDATE public.earnings_holds
      SET status = 'released', released_at = now()
      WHERE id = _hold.id;
  END LOOP;
END $$;

-- ============== RPC: auto-complete chat orders 24h after delivery ==============
CREATE OR REPLACE FUNCTION public.auto_complete_chat_orders()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _r RECORD; _n INT := 0; _hold RECORD;
BEGIN
  FOR _r IN
    SELECT c.order_id, c.id AS chat_id
    FROM public.order_chats c
    WHERE c.status = 'delivered'
      AND c.auto_complete_at IS NOT NULL
      AND c.auto_complete_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders SET status = 'completed', received_at = COALESCE(received_at, now())
      WHERE id = _r.order_id;
    UPDATE public.order_chats
      SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = _r.chat_id;
    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
      VALUES (_r.chat_id, NULL, 'system', 'Auto-completed after 24 hours. If there is a problem, open a support ticket.');
    FOR _hold IN
      SELECT id, user_id, amount FROM public.earnings_holds
        WHERE order_id = _r.order_id AND status = 'holding' FOR UPDATE
    LOOP
      UPDATE public.wallets
        SET balance = balance + _hold.amount,
            pending_balance = GREATEST(0, pending_balance - _hold.amount),
            updated_at = now()
        WHERE user_id = _hold.user_id;
      UPDATE public.earnings_holds
        SET status = 'released', released_at = now()
        WHERE id = _hold.id;
    END LOOP;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- ============== RPC: admin resolve seller flag ==============
CREATE OR REPLACE FUNCTION public.admin_resolve_seller_flag(_flag_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.seller_flags SET resolved = true WHERE id = _flag_id;
END $$;

-- ============== RPC: purchase a chat-delivery product ==============
CREATE OR REPLACE FUNCTION public.purchase_chat_product(
  _product_id UUID, _tier_label TEXT, _tier_price NUMERIC,
  _coupon_code TEXT DEFAULT NULL, _affiliate_slug TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _buyer UUID := auth.uid();
  _product public.products%ROWTYPE;
  _buyer_balance NUMERIC;
  _seller_share_pct NUMERIC;
  _seller_earning NUMERIC;
  _commission NUMERIC;
  _order_id UUID;
  _chat_id UUID;
  _commission_pct NUMERIC;
  _is_banned BOOLEAN;
  _final_price NUMERIC;
  _discount NUMERIC := 0;
  _coupon_id UUID := NULL;
  _coupon_msg TEXT;
  _affiliate_id UUID := NULL;
  _affiliate_user UUID := NULL;
  _affiliate_pct NUMERIC := 0;
  _aff_commission NUMERIC := 0;
  _referrer UUID;
  _is_first_order BOOLEAN;
  _allowed_price NUMERIC;
  _tier JSONB;
BEGIN
  IF _buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT is_banned INTO _is_banned FROM public.profiles WHERE id = _buyer;
  IF _is_banned THEN RAISE EXCEPTION 'Account suspended'; END IF;

  SELECT commission_percent INTO _commission_pct FROM public.platform_settings WHERE id = 1;
  IF _commission_pct IS NULL THEN _commission_pct := 10; END IF;

  SELECT * INTO _product FROM public.products
    WHERE id = _product_id AND status='approved' AND is_active=true AND delivery_mode='chat'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable'; END IF;
  IF _product.seller_id = _buyer THEN RAISE EXCEPTION 'Cannot buy your own product'; END IF;

  -- Validate tier price against stored price_tiers
  _allowed_price := NULL;
  FOR _tier IN SELECT * FROM jsonb_array_elements(_product.price_tiers) LOOP
    IF (_tier->>'label') = _tier_label THEN
      _allowed_price := (_tier->>'price')::NUMERIC * 1.10;  -- 10% markup
      EXIT;
    END IF;
  END LOOP;
  IF _allowed_price IS NULL THEN RAISE EXCEPTION 'Invalid plan tier'; END IF;
  -- Allow either the marked-up price or the raw price for backwards safety
  IF abs(_tier_price - round(_allowed_price,2)) > 0.5 THEN
    RAISE EXCEPTION 'Tier price mismatch';
  END IF;

  SELECT NOT EXISTS(SELECT 1 FROM public.orders WHERE buyer_id = _buyer) INTO _is_first_order;

  _final_price := round(_allowed_price, 2);

  IF _coupon_code IS NOT NULL AND length(trim(_coupon_code)) > 0 THEN
    SELECT v.coupon_id, v.discount, v.message INTO _coupon_id, _discount, _coupon_msg
      FROM public.validate_coupon(_coupon_code, _final_price) v;
    IF _coupon_id IS NOT NULL THEN
      _final_price := GREATEST(0, _final_price - COALESCE(_discount, 0));
    ELSE _discount := 0; END IF;
  END IF;

  IF _affiliate_slug IS NOT NULL AND length(trim(_affiliate_slug))>0 THEN
    SELECT a.id, a.user_id, a.commission_percent INTO _affiliate_id, _affiliate_user, _affiliate_pct
      FROM public.affiliates a WHERE a.slug = _affiliate_slug AND a.status='approved';
    IF _affiliate_user = _buyer THEN _affiliate_id := NULL; _affiliate_user := NULL; _affiliate_pct := 0; END IF;
  END IF;

  SELECT balance INTO _buyer_balance FROM public.wallets WHERE user_id=_buyer FOR UPDATE;
  IF _buyer_balance IS NULL OR _buyer_balance < _final_price THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  _seller_share_pct := (100 - _commission_pct)/100;
  _seller_earning := ROUND(_final_price * _seller_share_pct, 2);
  _commission := ROUND(_final_price - _seller_earning, 2);
  IF _affiliate_id IS NOT NULL THEN
    _aff_commission := ROUND(_final_price * _affiliate_pct/100, 2);
    IF _aff_commission > _commission THEN _aff_commission := _commission; END IF;
  END IF;

  UPDATE public.wallets SET balance = balance - _final_price, updated_at = now() WHERE user_id = _buyer;

  INSERT INTO public.orders (
    buyer_id, seller_id, product_id, service_name, total_paid,
    seller_earning, admin_commission,
    credentials_email, credentials_password,
    delivery_mode, tier_label, status
  ) VALUES (
    _buyer, _product.seller_id, _product.id,
    _product.service_name || ' (' || _tier_label || ')',
    _final_price, _seller_earning, _commission - _aff_commission,
    NULL, NULL,
    'chat', _tier_label, 'pending'::order_status
  )
  RETURNING id INTO _order_id;

  -- Hold seller earning
  PERFORM public.add_earning_to_hold(_product.seller_id, _seller_earning, 'sale', _order_id);

  -- Open chat
  INSERT INTO public.order_chats (order_id, buyer_id, seller_id, status, response_due_at)
  VALUES (_order_id, _buyer, _product.seller_id, 'pending_delivery', now() + interval '30 minutes')
  RETURNING id INTO _chat_id;
  UPDATE public.orders SET chat_id = _chat_id WHERE id = _order_id;

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
  VALUES (_chat_id, NULL, 'system',
    'New order placed. Seller, please deliver login credentials in this chat within 30 minutes. Sharing phone, email, WhatsApp or Telegram is strictly prohibited and will lead to a ban.');

  IF _coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, order_id, discount_applied)
    VALUES (_coupon_id, _buyer, _order_id, _discount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _coupon_id;
  END IF;

  IF _affiliate_id IS NOT NULL AND _aff_commission > 0 THEN
    PERFORM public.add_earning_to_hold(_affiliate_user, _aff_commission, 'affiliate', _order_id);
    INSERT INTO public.affiliate_conversions (affiliate_id, order_id, buyer_id, order_total, commission_percent, commission_amount)
    VALUES (_affiliate_id, _order_id, _buyer, _final_price, _affiliate_pct, _aff_commission);
    UPDATE public.affiliates SET total_conversions=total_conversions+1, total_earned=total_earned+_aff_commission, updated_at=now() WHERE id=_affiliate_id;
  END IF;

  IF _is_first_order THEN
    SELECT referred_by INTO _referrer FROM public.profiles WHERE id=_buyer;
    IF _referrer IS NOT NULL THEN
      UPDATE public.referrals SET status='rewarded', reward_amount=20, rewarded_at=now(), converted_at=COALESCE(converted_at, now())
        WHERE referred_user_id=_buyer AND status<>'rewarded';
      IF FOUND THEN
        PERFORM public.add_earning_to_hold(_referrer, 20, 'referral', _order_id);
      END IF;
    END IF;
  END IF;

  RETURN _order_id;
END $$;

-- ============== Realtime ==============
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_chats;

-- Allow 'pending' order status (already exists in enum normally; safe-guard)
DO $$ BEGIN
  ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending';
EXCEPTION WHEN others THEN NULL; END $$;