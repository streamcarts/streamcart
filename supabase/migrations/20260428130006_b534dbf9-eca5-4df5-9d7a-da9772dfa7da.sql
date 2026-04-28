
DO $$
DECLARE _uid UUID;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'admin@streamcart.in';
  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
      'admin@streamcart.in', crypt('Admin@123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"StreamCart Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (_uid::text, _uid, jsonb_build_object('sub', _uid::text, 'email', 'admin@streamcart.in', 'email_verified', true), 'email', now(), now(), now());
  END IF;

  INSERT INTO public.profiles (id, email, display_name) VALUES (_uid, 'admin@streamcart.in', 'StreamCart Admin')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (_uid, 0) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin') ON CONFLICT DO NOTHING;
END $$;
