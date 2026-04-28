CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('topup','checkout')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
  provider TEXT NOT NULL DEFAULT 'urpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  payment_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_intents_user ON public.payment_intents(user_id);
CREATE INDEX idx_payment_intents_provider_order ON public.payment_intents(provider_order_id);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi_self_select" ON public.payment_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "pi_admin_all" ON public.payment_intents FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Credit wallet from a paid topup intent (called from edge function with service role; SECURITY DEFINER wraps logic)
CREATE OR REPLACE FUNCTION public.urpay_mark_paid(_intent_id UUID, _provider_payment_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _pi public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO _pi FROM public.payment_intents WHERE id = _intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Intent not found'; END IF;
  IF _pi.status = 'paid' THEN RETURN; END IF;

  UPDATE public.payment_intents
    SET status = 'paid', provider_payment_id = _provider_payment_id, paid_at = now(), updated_at = now()
  WHERE id = _intent_id;

  IF _pi.purpose = 'topup' THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (_pi.user_id, _pi.amount)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;
END;
$$;