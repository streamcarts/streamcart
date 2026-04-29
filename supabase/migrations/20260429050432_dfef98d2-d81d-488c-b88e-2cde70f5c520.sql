ALTER FUNCTION public.detect_contact_info(TEXT) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.ensure_order_chat(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_chat_credentials(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_received(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_chat_product(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_seller_flag(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_complete_chat_orders() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ensure_order_chat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_chat_credentials(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_received(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_chat_product(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_seller_flag(UUID) TO authenticated;