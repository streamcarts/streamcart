DROP FUNCTION IF EXISTS public.complete_uropay_topup(text);
DROP FUNCTION IF EXISTS public.complete_uropay_checkout(text);
DROP FUNCTION IF EXISTS public.create_uropay_intent(uuid, text, numeric, text, text, text, text, jsonb);
DROP TABLE IF EXISTS public.uropay_orders CASCADE;