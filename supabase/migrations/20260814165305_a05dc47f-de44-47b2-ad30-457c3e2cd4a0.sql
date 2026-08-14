
-- 1. Delivery distance slabs
CREATE TABLE public.delivery_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_km numeric NOT NULL DEFAULT 0,
  max_km numeric NOT NULL,
  charge numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_slabs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_slabs TO authenticated;
GRANT ALL ON public.delivery_slabs TO service_role;
ALTER TABLE public.delivery_slabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_slabs_read" ON public.delivery_slabs FOR SELECT USING (true);
CREATE POLICY "delivery_slabs_admin" ON public.delivery_slabs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_delivery_slabs_updated_at BEFORE UPDATE ON public.delivery_slabs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Delivery partner payout slabs
CREATE TABLE public.delivery_payout_slabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_km numeric NOT NULL DEFAULT 0,
  max_km numeric NOT NULL,
  base_pay numeric NOT NULL DEFAULT 0,
  per_km numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_payout_slabs TO authenticated;
GRANT ALL ON public.delivery_payout_slabs TO service_role;
ALTER TABLE public.delivery_payout_slabs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_slabs_read" ON public.delivery_payout_slabs FOR SELECT TO authenticated USING (true);
CREATE POLICY "payout_slabs_admin" ON public.delivery_payout_slabs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_delivery_payout_slabs_updated_at BEFORE UPDATE ON public.delivery_payout_slabs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Shop types
CREATE TABLE public.shop_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'Store',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_types TO authenticated;
GRANT ALL ON public.shop_types TO service_role;
ALTER TABLE public.shop_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_types_read" ON public.shop_types FOR SELECT USING (true);
CREATE POLICY "shop_types_admin" ON public.shop_types FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_shop_types_updated_at BEFORE UPDATE ON public.shop_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS shop_type_id uuid REFERENCES public.shop_types(id) ON DELETE SET NULL;

INSERT INTO public.shop_types (name, icon, sort_order) VALUES
  ('Grocery','ShoppingBasket',1),
  ('Restaurant','UtensilsCrossed',2),
  ('Bakery','CakeSlice',3),
  ('Meat','Drumstick',4),
  ('Medicine','Pill',5)
ON CONFLICT (name) DO NOTHING;

-- 4. Seller offers (temporary reduced commission)
CREATE TABLE public.seller_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  promo_commission_pct numeric NOT NULL DEFAULT 0,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_offers TO authenticated;
GRANT ALL ON public.seller_offers TO service_role;
ALTER TABLE public.seller_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_offers_owner_read" ON public.seller_offers FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));
CREATE POLICY "seller_offers_admin" ON public.seller_offers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_seller_offers_updated_at BEFORE UPDATE ON public.seller_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Delivery incentives
CREATE TABLE public.delivery_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  orders_required integer NOT NULL DEFAULT 10,
  bonus_amount numeric NOT NULL DEFAULT 0,
  period text NOT NULL DEFAULT 'DAILY',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_incentives TO authenticated;
GRANT ALL ON public.delivery_incentives TO service_role;
ALTER TABLE public.delivery_incentives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incentives_read" ON public.delivery_incentives FOR SELECT TO authenticated USING (true);
CREATE POLICY "incentives_admin" ON public.delivery_incentives FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_delivery_incentives_updated_at BEFORE UPDATE ON public.delivery_incentives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Admin bank details
CREATE TABLE public.admin_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_holder text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_number text NOT NULL DEFAULT '',
  ifsc text NOT NULL DEFAULT '',
  upi_id text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_bank_accounts TO authenticated;
GRANT ALL ON public.admin_bank_accounts TO service_role;
ALTER TABLE public.admin_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_bank_admin_only" ON public.admin_bank_accounts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_admin_bank_accounts_updated_at BEFORE UPDATE ON public.admin_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Admin revenue settlements
CREATE TABLE public.admin_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  utr text,
  note text,
  bank_account_id uuid REFERENCES public.admin_bank_accounts(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_settlements TO authenticated;
GRANT ALL ON public.admin_settlements TO service_role;
ALTER TABLE public.admin_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_settlements_admin_only" ON public.admin_settlements FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_admin_settlements_updated_at BEFORE UPDATE ON public.admin_settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Order disputes / refunds
CREATE TABLE public.order_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'OPEN',
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_mode text,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_disputes TO authenticated;
GRANT ALL ON public.order_disputes TO service_role;
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes_read_own_or_admin" ON public.order_disputes FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin());
CREATE POLICY "disputes_customer_create" ON public.order_disputes FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "disputes_admin_manage" ON public.order_disputes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "disputes_admin_delete" ON public.order_disputes FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER update_order_disputes_updated_at BEFORE UPDATE ON public.order_disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Audit logs
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_admin_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "audit_admin_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND actor_id = auth.uid());

-- 10. Moderation status on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE';

-- 11. Seed slabs from existing settings defaults
INSERT INTO public.delivery_slabs (min_km, max_km, charge) VALUES (0,3,20),(3,7,40),(7,12,60);
INSERT INTO public.delivery_payout_slabs (min_km, max_km, base_pay, per_km) VALUES (0,5,30,4),(5,12,40,5);
INSERT INTO public.admin_bank_accounts (account_holder) VALUES ('') ON CONFLICT DO NOTHING;
