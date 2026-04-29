CREATE OR REPLACE FUNCTION public.trg_notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  seller_link text;
  buyer_link text;
BEGIN
  IF NEW.delivery_mode = 'chat' THEN
    seller_link := '/orders/chat/' || NEW.id::text;
    buyer_link  := '/orders/chat/' || NEW.id::text;
  ELSE
    seller_link := '/seller';
    buyer_link  := '/buyer';
  END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.seller_id, 'order_new',
          '🛒 New order received',
          'New order: ' || NEW.service_name || '. Open chat to deliver.',
          seller_link, jsonb_build_object('order_id', NEW.id));

  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.buyer_id, 'order_placed',
          '✅ Order placed',
          CASE WHEN NEW.delivery_mode = 'chat'
               THEN 'Your order for ' || NEW.service_name || ' is confirmed. Chat with seller now.'
               ELSE 'Your order for ' || NEW.service_name || ' is confirmed.' END,
          buyer_link, jsonb_build_object('order_id', NEW.id));

  RETURN NEW;
END $function$;