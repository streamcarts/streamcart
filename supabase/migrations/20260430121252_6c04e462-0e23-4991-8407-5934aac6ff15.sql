
-- 1) Tighten coupons: only admins read full list; public validates via RPC validate_coupon
DROP POLICY IF EXISTS coupons_public_read ON public.coupons;
CREATE POLICY coupons_self_or_admin_read ON public.coupons
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR (owner_user_id IS NOT NULL AND owner_user_id = auth.uid()));

-- 2) Tighten affiliate_clicks insert: must be tracked through RPC (track_affiliate_click)
--    Block direct inserts entirely; rely on SECURITY DEFINER RPC.
DROP POLICY IF EXISTS aff_clicks_authed_insert ON public.affiliate_clicks;

-- 3) Set immutable search_path on all SECURITY DEFINER functions in public to prevent
--    schema-hijack style attacks. Apply ALTER FUNCTION ... SET search_path = public, pg_temp.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END$$;
