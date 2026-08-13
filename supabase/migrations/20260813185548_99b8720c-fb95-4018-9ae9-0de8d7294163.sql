ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS commission_pct numeric;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS store_status text NOT NULL DEFAULT 'OPEN';

CREATE TABLE IF NOT EXISTS public.store_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  status text NOT NULL DEFAULT 'PENDING',
  transaction_id text,
  paid_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_payouts TO authenticated;
GRANT ALL ON public.store_payouts TO service_role;
ALTER TABLE public.store_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts admin all" ON public.store_payouts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "payouts seller read" ON public.store_payouts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_payouts.store_id AND s.seller_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.delivery_cash_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_boy_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  transaction_id text,
  note text,
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_cash_settlements TO authenticated;
GRANT ALL ON public.delivery_cash_settlements TO service_role;
ALTER TABLE public.delivery_cash_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash admin all" ON public.delivery_cash_settlements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cash own read" ON public.delivery_cash_settlements FOR SELECT TO authenticated USING (delivery_boy_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  subtitle text,
  image_url text,
  link_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners public read" ON public.banners FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "banners admin write" ON public.banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles admin read all" ON public.profiles;
CREATE POLICY "profiles admin read all" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "orders admin all" ON public.orders;
CREATE POLICY "orders admin all" ON public.orders FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "dp admin all" ON public.delivery_profiles;
CREATE POLICY "dp admin all" ON public.delivery_profiles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_store_payouts_updated_at BEFORE UPDATE ON public.store_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();