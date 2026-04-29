-- Update purchase_chat_product to send a detailed first system message
CREATE OR REPLACE FUNCTION public.purchase_chat_product(_product_id uuid, _tier_label text, _tier_price numeric, _coupon_code text DEFAULT NULL::text, _affiliate_slug text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  _buyer_name TEXT;
  _intro TEXT;
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

  _allowed_price := NULL;
  FOR _tier IN SELECT * FROM jsonb_array_elements(_product.price_tiers) LOOP
    IF (_tier->>'label') = _tier_label THEN
      _allowed_price := (_tier->>'price')::NUMERIC * 1.10;
      EXIT;
    END IF;
  END LOOP;
  IF _allowed_price IS NULL THEN RAISE EXCEPTION 'Invalid plan tier'; END IF;
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

  PERFORM public.add_earning_to_hold(_product.seller_id, _seller_earning, 'sale', _order_id);

  INSERT INTO public.order_chats (order_id, buyer_id, seller_id, status, response_due_at)
  VALUES (_order_id, _buyer, _product.seller_id, 'pending_delivery', now() + interval '30 minutes')
  RETURNING id INTO _chat_id;
  UPDATE public.orders SET chat_id = _chat_id WHERE id = _order_id;

  SELECT COALESCE(display_name, split_part(email,'@',1), 'Buyer') INTO _buyer_name
    FROM public.profiles WHERE id = _buyer;

  _intro :=
    E'🛒 *New paid order received*\n' ||
    E'━━━━━━━━━━━━━━━━━━━━\n' ||
    '👤 Buyer: ' || COALESCE(_buyer_name,'Buyer') || E'\n' ||
    '📦 Product: ' || _product.service_name || E'\n' ||
    '⏱ Plan / Duration: ' || _tier_label || E'\n' ||
    '💰 Amount paid: ₹' || to_char(_final_price, 'FM999999990.00') || E'\n' ||
    '🆔 Order: #' || substring(_order_id::text, 1, 8) || E'\n' ||
    E'━━━━━━━━━━━━━━━━━━━━\n' ||
    E'➡️ Seller, please deliver the login credentials in this chat within *30 minutes* using the "Send credentials" button.\n' ||
    E'⚠️ Sharing phone, email, WhatsApp, Telegram or any external link is strictly prohibited and will lead to an automatic ban.';

  INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
  VALUES (_chat_id, NULL, 'system', _intro);

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
END $function$;

-- Same richer message when chat is created lazily for an existing order
CREATE OR REPLACE FUNCTION public.ensure_order_chat(_order_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _o public.orders%ROWTYPE;
  _chat_id UUID;
  _buyer_name TEXT;
  _intro TEXT;
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

    SELECT COALESCE(display_name, split_part(email,'@',1), 'Buyer') INTO _buyer_name
      FROM public.profiles WHERE id = _o.buyer_id;

    _intro :=
      E'🛒 *New paid order received*\n' ||
      E'━━━━━━━━━━━━━━━━━━━━\n' ||
      '👤 Buyer: ' || COALESCE(_buyer_name,'Buyer') || E'\n' ||
      '📦 Product: ' || _o.service_name || E'\n' ||
      COALESCE('⏱ Plan / Duration: ' || _o.tier_label || E'\n', '') ||
      '💰 Amount paid: ₹' || to_char(_o.total_paid, 'FM999999990.00') || E'\n' ||
      '🆔 Order: #' || substring(_order_id::text, 1, 8) || E'\n' ||
      E'━━━━━━━━━━━━━━━━━━━━\n' ||
      E'➡️ Seller, please deliver the login credentials in this chat within *30 minutes* using the "Send credentials" button.\n' ||
      E'⚠️ Sharing phone, email, WhatsApp, Telegram or any external link is strictly prohibited and will lead to an automatic ban.';

    INSERT INTO public.chat_messages (chat_id, sender_id, kind, body)
    VALUES (_chat_id, NULL, 'system', _intro);
  END IF;
  RETURN _chat_id;
END $function$;