-- =========================================================
-- PLATFORMS (admin-curated)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  category public.product_category NOT NULL DEFAULT 'Other',
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY platforms_public_read ON public.platforms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY platforms_admin_all ON public.platforms
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- DURATIONS (admin list of allowed durations)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platform_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,        -- e.g. "30 Days"
  days INT NOT NULL,                 -- canonical length in days
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_durations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdur_public_read ON public.platform_durations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY pdur_admin_all ON public.platform_durations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- PRICING (per platform + duration minimum price)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.platform_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id UUID NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  duration_id UUID NOT NULL REFERENCES public.platform_durations(id) ON DELETE CASCADE,
  min_price NUMERIC(10,2) NOT NULL CHECK (min_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform_id, duration_id)
);
ALTER TABLE public.platform_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppricing_public_read ON public.platform_pricing
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY ppricing_admin_all ON public.platform_pricing
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Touch updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_platforms_touch BEFORE UPDATE ON public.platforms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_ppricing_touch BEFORE UPDATE ON public.platform_pricing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- Link products to platform (optional FK; keeps existing 'platform' text in sync)
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS platform_id UUID REFERENCES public.platforms(id) ON DELETE SET NULL;

-- =========================================================
-- Helper: lookup minimum price
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_platform_min_price(_platform_id UUID, _duration_label TEXT)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pp.min_price
  FROM public.platform_pricing pp
  JOIN public.platform_durations pd ON pd.id = pp.duration_id
  WHERE pp.platform_id = _platform_id AND pd.label = _duration_label
$$;

-- =========================================================
-- Trigger: enforce min price on product insert/update
-- (only when a platform_id is set and price_tiers is provided)
-- =========================================================
CREATE OR REPLACE FUNCTION public.enforce_platform_min_price()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _tier JSONB; _min NUMERIC; _label TEXT; _price NUMERIC;
BEGIN
  IF NEW.platform_id IS NULL OR NEW.price_tiers IS NULL OR jsonb_array_length(NEW.price_tiers) = 0 THEN
    RETURN NEW;
  END IF;
  FOR _tier IN SELECT * FROM jsonb_array_elements(NEW.price_tiers) LOOP
    _label := _tier->>'label';
    _price := (_tier->>'price')::NUMERIC;
    _min := public.get_platform_min_price(NEW.platform_id, _label);
    IF _min IS NULL THEN
      RAISE EXCEPTION 'Duration "%" is not allowed for this platform', _label;
    END IF;
    IF _price < _min THEN
      RAISE EXCEPTION 'Price for % must be at least ₹%', _label, _min;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_min_price ON public.products;
CREATE TRIGGER trg_enforce_min_price
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_platform_min_price();

-- =========================================================
-- Storage bucket for platform logos (admin upload)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-logos', 'platform-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "platform_logos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'platform-logos');

CREATE POLICY "platform_logos_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'platform-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "platform_logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'platform-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "platform_logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'platform-logos' AND public.is_admin(auth.uid()));

-- =========================================================
-- Seed: default durations
-- =========================================================
INSERT INTO public.platform_durations (label, days, sort_order) VALUES
  ('15 Days', 15, 10),
  ('30 Days', 30, 20),
  ('45 Days', 45, 30),
  ('3 Months', 90, 40)
ON CONFLICT (label) DO NOTHING;

-- Seed: starter platforms
INSERT INTO public.platforms (name, slug, category, sort_order, logo_url) VALUES
  ('Netflix',            'netflix',  'OTT',      10, NULL),
  ('Amazon Prime Video', 'prime',    'OTT',      20, NULL),
  ('Disney+ Hotstar',    'hotstar',  'OTT',      30, NULL),
  ('SonyLIV',            'sonyliv',  'OTT',      40, NULL),
  ('ZEE5',               'zee5',     'OTT',      50, NULL),
  ('ChatGPT Plus',       'chatgpt',  'AI Tools', 60, NULL),
  ('Canva Pro',          'canva',    'Other',    70, NULL),
  ('NordVPN',            'nordvpn',  'VPN',      80, NULL)
ON CONFLICT (name) DO NOTHING;

-- Seed: minimum prices for each platform × duration
INSERT INTO public.platform_pricing (platform_id, duration_id, min_price)
SELECT p.id, d.id,
  CASE p.slug
    WHEN 'netflix'  THEN CASE d.label WHEN '15 Days' THEN 70 WHEN '30 Days' THEN 130 WHEN '45 Days' THEN 180 WHEN '3 Months' THEN 320 END
    WHEN 'prime'    THEN CASE d.label WHEN '15 Days' THEN 40 WHEN '30 Days' THEN 70  WHEN '45 Days' THEN 100 WHEN '3 Months' THEN 180 END
    WHEN 'hotstar'  THEN CASE d.label WHEN '15 Days' THEN 50 WHEN '30 Days' THEN 90  WHEN '45 Days' THEN 130 WHEN '3 Months' THEN 230 END
    WHEN 'sonyliv'  THEN CASE d.label WHEN '15 Days' THEN 40 WHEN '30 Days' THEN 70  WHEN '45 Days' THEN 100 WHEN '3 Months' THEN 180 END
    WHEN 'zee5'     THEN CASE d.label WHEN '15 Days' THEN 35 WHEN '30 Days' THEN 60  WHEN '45 Days' THEN 90  WHEN '3 Months' THEN 160 END
    WHEN 'chatgpt'  THEN CASE d.label WHEN '15 Days' THEN 250 WHEN '30 Days' THEN 450 WHEN '45 Days' THEN 650 WHEN '3 Months' THEN 1100 END
    WHEN 'canva'    THEN CASE d.label WHEN '15 Days' THEN 60 WHEN '30 Days' THEN 110 WHEN '45 Days' THEN 160 WHEN '3 Months' THEN 280 END
    WHEN 'nordvpn'  THEN CASE d.label WHEN '15 Days' THEN 80 WHEN '30 Days' THEN 150 WHEN '45 Days' THEN 220 WHEN '3 Months' THEN 380 END
  END
FROM public.platforms p CROSS JOIN public.platform_durations d
ON CONFLICT (platform_id, duration_id) DO NOTHING;