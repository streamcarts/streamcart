-- Razorpay orders tracking table
CREATE TABLE public.razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rzp_order_id TEXT NOT NULL UNIQUE,
  rzp_payment_id TEXT,
  rzp_signature TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  purpose TEXT NOT NULL CHECK (purpose IN ('topup','checkout')),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed','verified')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_rzp_orders_user ON public.razorpay_orders(user_id);
CREATE INDEX idx_rzp_orders_rzp_id ON public.razorpay_orders(rzp_order_id);

ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rzp_self_select" ON public.razorpay_orders
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "rzp_admin_all" ON public.razorpay_orders
FOR ALL TO authenticated
USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Inserts/updates only happen from edge functions using service role, so no insert/update policies needed for users.

-- RPC: credit wallet after verified Razorpay topup (called by edge function via service role)
CREATE OR REPLACE FUNCTION public.complete_razorpay_topup(_rzp_order_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row razorpay_orders%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM razorpay_orders WHERE rzp_order_id = _rzp_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _row.status = 'verified' THEN RETURN; END IF;
  IF _row.purpose <> 'topup' THEN RAISE EXCEPTION 'Wrong purpose'; END IF;

  -- Ensure wallet exists
  INSERT INTO wallets (user_id, balance) VALUES (_row.user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE wallets SET balance = balance + _row.amount, updated_at = now()
  WHERE user_id = _row.user_id;

  UPDATE razorpay_orders
  SET status = 'verified', verified_at = now()
  WHERE rzp_order_id = _rzp_order_id;
END;
$$;