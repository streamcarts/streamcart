CREATE TYPE public.uropay_status AS ENUM ('created','paid','completed','failed','expired');
CREATE TYPE public.uropay_purpose AS ENUM ('checkout','topup');

CREATE TABLE public.uropay_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  purpose public.uropay_purpose NOT NULL,
  uropay_order_id TEXT NOT NULL UNIQUE,
  merchant_order_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reference_number TEXT,
  status public.uropay_status NOT NULL DEFAULT 'created',
  upi_string TEXT,
  qr_code TEXT,
  payload JSONB,
  result_ids JSONB,
  webhook_amount NUMERIC(12,2),
  webhook_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uropay_orders_user ON public.uropay_orders(user_id);
CREATE INDEX idx_uropay_orders_status ON public.uropay_orders(status);
CREATE INDEX idx_uropay_orders_ref ON public.uropay_orders(reference_number) WHERE reference_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_uropay_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_uropay_updated_at
BEFORE UPDATE ON public.uropay_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_uropay_updated_at();

ALTER TABLE public.uropay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own uropay orders"
ON public.uropay_orders FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all uropay orders"
ON public.uropay_orders FOR SELECT
USING (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'admin_staff'));

CREATE OR REPLACE FUNCTION public.create_uropay_intent(
  _user_id UUID,
  _purpose public.uropay_purpose,
  _amount NUMERIC,
  _uropay_order_id TEXT,
  _merchant_order_id TEXT,
  _upi_string TEXT,
  _qr_code TEXT,
  _payload JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.uropay_orders(user_id,purpose,amount,uropay_order_id,merchant_order_id,upi_string,qr_code,payload)
  VALUES (_user_id,_purpose,_amount,_uropay_order_id,_merchant_order_id,_upi_string,_qr_code,_payload)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.complete_uropay_topup(_uropay_order_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _row public.uropay_orders%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.uropay_orders WHERE uropay_order_id = _uropay_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF _row.status = 'completed' THEN RETURN TRUE; END IF;
  IF _row.purpose <> 'topup' THEN RAISE EXCEPTION 'wrong purpose'; END IF;

  INSERT INTO public.wallets(user_id,balance) VALUES (_row.user_id,0)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance = balance + _row.amount, updated_at = now()
  WHERE user_id = _row.user_id;

  UPDATE public.uropay_orders SET status='completed', completed_at=now() WHERE id=_row.id;
  RETURN TRUE;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_product_as(
  _user_id UUID,
  _product_id UUID,
  _coupon_code TEXT DEFAULT NULL,
  _affiliate_slug TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _result UUID;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _user_id::text)::text, true);
  SELECT public.purchase_product(_product_id, _coupon_code, _affiliate_slug) INTO _result;
  RETURN _result;
END $$;

CREATE OR REPLACE FUNCTION public.complete_uropay_checkout(_uropay_order_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _row public.uropay_orders%ROWTYPE;
  _items JSONB; _coupon TEXT; _aff TEXT;
  _item JSONB; _qty INT; _i INT;
  _new_id UUID; _ids UUID[] := ARRAY[]::UUID[];
  _applied BOOLEAN := FALSE;
BEGIN
  SELECT * INTO _row FROM public.uropay_orders WHERE uropay_order_id = _uropay_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status = 'completed' THEN RETURN COALESCE(_row.result_ids, '[]'::jsonb); END IF;
  IF _row.purpose <> 'checkout' THEN RAISE EXCEPTION 'wrong purpose'; END IF;

  _items := _row.payload -> 'items';
  _coupon := _row.payload ->> 'coupon_code';
  _aff := _row.payload ->> 'affiliate_slug';

  -- Credit wallet by exact amount so purchase_product can deduct
  INSERT INTO public.wallets(user_id,balance) VALUES (_row.user_id,0)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.wallets SET balance = balance + _row.amount, updated_at = now()
  WHERE user_id = _row.user_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'qty')::int, 1);
    FOR _i IN 1.._qty LOOP
      IF NOT _applied AND _coupon IS NOT NULL THEN
        SELECT public.purchase_product_as(_row.user_id, (_item->>'id')::uuid, _coupon, _aff) INTO _new_id;
        _applied := TRUE;
      ELSE
        SELECT public.purchase_product_as(_row.user_id, (_item->>'id')::uuid, NULL, _aff) INTO _new_id;
      END IF;
      _ids := _ids || _new_id;
    END LOOP;
  END LOOP;

  UPDATE public.uropay_orders
  SET status='completed', completed_at=now(), result_ids=to_jsonb(_ids)
  WHERE id=_row.id;
  RETURN to_jsonb(_ids);
END $$;