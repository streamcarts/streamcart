REVOKE EXECUTE ON FUNCTION public.create_uropay_intent(uuid, public.uropay_purpose, numeric, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_uropay_topup(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_uropay_checkout(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_product_as(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;