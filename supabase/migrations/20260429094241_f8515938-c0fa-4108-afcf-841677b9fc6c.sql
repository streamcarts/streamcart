CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin'::app_role, 'admin'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_team_role(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin'::app_role, 'admin'::app_role, 'admin_staff'::app_role, 'support'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_payments(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin'::app_role, 'admin'::app_role, 'admin_staff'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_handle_support(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_team_role(_uid)
$$;

CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_log_actor ON public.admin_activity_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_action ON public.admin_activity_log(action, created_at DESC);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS log_super_admin_read ON public.admin_activity_log;
CREATE POLICY "log_super_admin_read" ON public.admin_activity_log
FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS log_self_read ON public.admin_activity_log;
CREATE POLICY "log_self_read" ON public.admin_activity_log
FOR SELECT TO authenticated USING (actor_id = auth.uid());

DROP POLICY IF EXISTS log_team_insert ON public.admin_activity_log;
CREATE POLICY "log_team_insert" ON public.admin_activity_log
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() AND public.has_team_role(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF NOT public.has_team_role(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.admin_activity_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

DROP POLICY IF EXISTS roles_admin_manage ON public.user_roles;
CREATE POLICY "roles_super_admin_manage" ON public.user_roles
FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.add_team_member(_email text, _role app_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admin can manage team';
  END IF;
  IF _role NOT IN ('super_admin'::app_role, 'admin_staff'::app_role, 'support'::app_role) THEN
    RAISE EXCEPTION 'Invalid team role';
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found. They must sign up first.');
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, _role)
  ON CONFLICT DO NOTHING;
  PERFORM public.log_admin_action('team.add', 'user', _uid::text, jsonb_build_object('email', _email, 'role', _role));
  RETURN jsonb_build_object('ok', true, 'user_id', _uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_role(_user_id uuid, _role app_role)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admin can manage team';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;
  PERFORM public.log_admin_action('team.remove', 'user', _user_id::text, jsonb_build_object('role', _role));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE(user_id uuid, email text, display_name text, role app_role, created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.user_id, p.email, p.display_name, ur.role, ur.created_at
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role IN ('super_admin'::app_role, 'admin'::app_role, 'admin_staff'::app_role, 'support'::app_role)
    AND public.is_super_admin(auth.uid())
  ORDER BY ur.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.add_team_member(text, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.remove_team_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_team_members() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM anon;