
-- 1. business_settings (single row)
CREATE TABLE public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  brand_name text NOT NULL DEFAULT 'Mannu A2Z Mart',
  tagline text NOT NULL DEFAULT 'Aapke ghar ki digital dukan',
  fssai_number text,
  udyam_number text,
  support_phone text,
  support_email text,
  upi_id text,
  qr_image_url text,
  base_delivery_charge numeric NOT NULL DEFAULT 20,
  per_km_rate numeric NOT NULL DEFAULT 8,
  commission_pct numeric NOT NULL DEFAULT 10,
  min_payout_limit numeric NOT NULL DEFAULT 200,
  about_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_settings TO anon;
GRANT SELECT ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_settings public read" ON public.business_settings FOR SELECT USING (true);
CREATE POLICY "business_settings admin write" ON public.business_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.business_settings (singleton) VALUES (true);

-- 2. stores FSSAI
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS fssai_number text,
  ADD COLUMN IF NOT EXISTS fssai_doc_url text,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.role_requests
  ADD COLUMN IF NOT EXISTS fssai_number text,
  ADD COLUMN IF NOT EXISTS fssai_doc_url text;

-- 3. category rules
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS allowed_units jsonb NOT NULL DEFAULT '["Kg","Gram","Pcs","Litre"]'::jsonb,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{"sizes":false,"colors":false,"veg_badge":false}'::jsonb;

-- 4. wallets
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet owner read" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  kind text NOT NULL,
  note text,
  order_id uuid REFERENCES public.orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet tx owner read" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- 5. daily sequential order numbers
CREATE TABLE public.order_number_counters (
  day date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0
);
GRANT ALL ON public.order_number_counters TO service_role;
ALTER TABLE public.order_number_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_order_no()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  n integer;
BEGIN
  INSERT INTO public.order_number_counters (day, last_no) VALUES (d, 1)
  ON CONFLICT (day) DO UPDATE SET last_no = public.order_number_counters.last_no + 1
  RETURNING last_no INTO n;
  NEW.order_no := 'MAM-' || to_char(d, 'YYYYMMDD') || '-' || lpad(n::text, 4, '0');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_order_no() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_order_no_trigger ON public.orders;
CREATE TRIGGER set_order_no_trigger BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_order_no();
