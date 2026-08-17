-- Seller ledger
CREATE TABLE IF NOT EXISTS public.seller_wallets (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  unsettled_balance numeric NOT NULL DEFAULT 0,
  lifetime_earned numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_wallets TO authenticated;
GRANT ALL ON public.seller_wallets TO service_role;
ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_wallets_read" ON public.seller_wallets FOR SELECT TO authenticated
USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- Rider ledger
CREATE TABLE IF NOT EXISTS public.driver_earnings (
  user_id uuid PRIMARY KEY,
  unsettled_balance numeric NOT NULL DEFAULT 0,
  lifetime_earned numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.driver_earnings TO authenticated;
GRANT ALL ON public.driver_earnings TO service_role;
ALTER TABLE public.driver_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_earnings_read" ON public.driver_earnings FOR SELECT TO authenticated
USING (public.is_admin() OR user_id = auth.uid());

-- Settlement history
CREATE TABLE IF NOT EXISTS public.settlement_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payee_type text NOT NULL CHECK (payee_type IN ('SELLER','RIDER')),
  payee_id uuid NOT NULL,
  payee_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  method text,
  reference text,
  note text,
  settled_by uuid,
  settled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settlement_history TO authenticated;
GRANT ALL ON public.settlement_history TO service_role;
ALTER TABLE public.settlement_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settlement_history_admin_all" ON public.settlement_history FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "settlement_history_own_read" ON public.settlement_history FOR SELECT TO authenticated
USING (payee_id = auth.uid() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = payee_id AND s.seller_id = auth.uid()));

-- Recipient contact on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS recipient_phone text;

-- Store legal + payout details
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS udyam_number text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_upi_id text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS payout_qr_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS bank_details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Rider payout details
ALTER TABLE public.delivery_profiles ADD COLUMN IF NOT EXISTS payout_upi_id text;
ALTER TABLE public.delivery_profiles ADD COLUMN IF NOT EXISTS payout_qr_url text;
ALTER TABLE public.delivery_profiles ADD COLUMN IF NOT EXISTS bank_details jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed ledger rows for existing stores / riders
INSERT INTO public.seller_wallets (store_id) SELECT id FROM public.stores ON CONFLICT DO NOTHING;
INSERT INTO public.driver_earnings (user_id) SELECT user_id FROM public.delivery_profiles ON CONFLICT DO NOTHING;