
-- ============ NOTIFICATIONS TABLE ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  data jsonb,
  is_read boolean NOT NULL DEFAULT false,
  push_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unsent ON public.notifications(push_sent) WHERE push_sent = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_self_select ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY notif_self_update ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_admin_all ON public.notifications FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ PUSH SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psub_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY psub_self_all ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid());

-- ============ HELPER: notify all admins ============
CREATE OR REPLACE FUNCTION public.notify_admins(_type text, _title text, _body text, _link text, _data jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  SELECT ur.user_id, _type, _title, _body, _link, _data
  FROM public.user_roles ur WHERE ur.role = 'admin';
END $$;

-- ============ TRIGGER: new order ============
CREATE OR REPLACE FUNCTION public.trg_notify_new_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.seller_id, 'order_new', 'New order received',
          'You sold: ' || NEW.service_name,
          '/seller', jsonb_build_object('order_id', NEW.id));
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.buyer_id, 'order_placed', 'Order placed',
          'Your order for ' || NEW.service_name || ' is confirmed.',
          '/buyer', jsonb_build_object('order_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_new_order ON public.orders;
CREATE TRIGGER notify_new_order AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_order();

-- ============ TRIGGER: order delivered (credentials sent) ============
CREATE OR REPLACE FUNCTION public.trg_notify_order_delivered() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.credentials_sent_at IS NULL AND NEW.credentials_sent_at IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (NEW.buyer_id, 'order_delivered', 'Order delivered',
            'Credentials are ready for ' || NEW.service_name,
            '/buyer', jsonb_build_object('order_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_order_delivered ON public.orders;
CREATE TRIGGER notify_order_delivered AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_delivered();

-- ============ TRIGGER: new chat message ============
CREATE OR REPLACE FUNCTION public.trg_notify_chat_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer uuid; v_seller uuid; v_recipient uuid; v_preview text;
BEGIN
  IF NEW.sender_id IS NULL THEN RETURN NEW; END IF;
  SELECT buyer_id, seller_id INTO v_buyer, v_seller
  FROM public.order_chats WHERE id = NEW.chat_id;
  IF NEW.sender_id = v_buyer THEN v_recipient := v_seller;
  ELSE v_recipient := v_buyer;
  END IF;
  v_preview := COALESCE(LEFT(NEW.body, 80), CASE WHEN NEW.cred_email IS NOT NULL THEN 'Sent credentials' ELSE 'Sent an attachment' END);
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (v_recipient, 'chat_message', 'New message', v_preview,
          '/orders/chat/' || (SELECT order_id FROM public.order_chats WHERE id = NEW.chat_id),
          jsonb_build_object('chat_id', NEW.chat_id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_chat_message ON public.chat_messages;
CREATE TRIGGER notify_chat_message AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_chat_message();

-- ============ TRIGGER: withdrawal status change ============
CREATE OR REPLACE FUNCTION public.trg_notify_withdrawal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins('withdrawal_request', 'New withdrawal request',
      '₹' || NEW.amount || ' requested', '/admin', jsonb_build_object('withdrawal_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (NEW.seller_id, 'withdrawal_' || NEW.status::text,
      'Withdrawal ' || NEW.status::text,
      '₹' || NEW.amount || ' is ' || NEW.status::text,
      '/seller', jsonb_build_object('withdrawal_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_withdrawal ON public.withdrawals;
CREATE TRIGGER notify_withdrawal AFTER INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_withdrawal();

-- ============ TRIGGER: wallet topup status ============
CREATE OR REPLACE FUNCTION public.trg_notify_topup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (NEW.user_id, 'topup_' || NEW.status::text,
      'Top-up ' || NEW.status::text,
      '₹' || NEW.amount || ' is ' || NEW.status::text,
      '/buyer', jsonb_build_object('topup_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_topup ON public.wallet_topups;
CREATE TRIGGER notify_topup AFTER UPDATE ON public.wallet_topups
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_topup();

-- ============ TRIGGER: new pending order (payment to verify) ============
CREATE OR REPLACE FUNCTION public.trg_notify_pending_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_admins('payment_pending', 'Payment to verify',
    '₹' || NEW.amount || ' awaiting approval', '/admin',
    jsonb_build_object('pending_order_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_pending_order ON public.pending_orders;
CREATE TRIGGER notify_pending_order AFTER INSERT ON public.pending_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_pending_order();

-- ============ TRIGGER: complaint ============
CREATE OR REPLACE FUNCTION public.trg_notify_complaint() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.seller_id, 'complaint_new', 'Complaint filed against you',
    NEW.reason, '/seller', jsonb_build_object('complaint_id', NEW.id));
  PERFORM public.notify_admins('complaint_new', 'New complaint',
    NEW.reason, '/admin', jsonb_build_object('complaint_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_complaint ON public.complaints;
CREATE TRIGGER notify_complaint AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_complaint();

-- ============ TRIGGER: vendor application ============
CREATE OR REPLACE FUNCTION public.trg_notify_vendor_app() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_admins('vendor_application', 'New seller application',
      NEW.business_name, '/admin', jsonb_build_object('application_id', NEW.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (NEW.user_id, 'vendor_app_' || NEW.status::text,
      'Seller application ' || NEW.status::text,
      'Your application is ' || NEW.status::text,
      '/sell', jsonb_build_object('application_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_vendor_app ON public.vendor_applications;
CREATE TRIGGER notify_vendor_app AFTER INSERT OR UPDATE ON public.vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_vendor_app();

-- ============ TRIGGER: review received ============
CREATE OR REPLACE FUNCTION public.trg_notify_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, link, data)
  VALUES (NEW.seller_id, 'review_new', 'New review',
    NEW.rating || '★ ' || COALESCE(LEFT(NEW.comment, 80), ''),
    '/seller', jsonb_build_object('review_id', NEW.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_review ON public.reviews;
CREATE TRIGGER notify_review AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_review();

-- ============ TRIGGER: product status change (listing approved/rejected) ============
CREATE OR REPLACE FUNCTION public.trg_notify_product_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, link, data)
    VALUES (NEW.seller_id, 'product_' || NEW.status::text,
      'Listing ' || NEW.status::text,
      NEW.service_name, '/seller', jsonb_build_object('product_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_product_status ON public.products;
CREATE TRIGGER notify_product_status AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_status();
