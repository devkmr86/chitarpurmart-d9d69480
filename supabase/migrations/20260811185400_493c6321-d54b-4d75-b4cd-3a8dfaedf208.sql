
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('ADMIN','CUSTOMER','SELLER','DELIVERY');
CREATE TYPE public.approval_status AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE public.order_status AS ENUM ('PLACED','ACCEPTED','PREPARING','READY','ASSIGNED','PICKED_UP','ON_THE_WAY','DELIVERED','CANCELLED');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  status public.approval_status NOT NULL DEFAULT 'APPROVED',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'ADMIN');
$$;

CREATE POLICY "profiles own read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());
CREATE POLICY "roles own read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'CUSTOMER')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'ShoppingBasket',
  commission_pct numeric NOT NULL DEFAULT 10,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- UNITS
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.units TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "units public read" ON public.units FOR SELECT USING (true);
CREATE POLICY "units admin write" ON public.units FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- STORES
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid,
  store_name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  address_line text NOT NULL DEFAULT '',
  latitude double precision NOT NULL DEFAULT 23.3441,
  longitude double precision NOT NULL DEFAULT 85.3096,
  phone text,
  image_url text,
  rating numeric NOT NULL DEFAULT 4.3,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores public read" ON public.stores FOR SELECT USING (true);
CREATE POLICY "stores seller write" ON public.stores FOR ALL TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin())
  WITH CHECK (seller_id = auth.uid() OR public.is_admin());

-- RELOCATION REQUESTS
CREATE TABLE public.store_relocation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  old_address text NOT NULL,
  old_lat double precision NOT NULL,
  old_lng double precision NOT NULL,
  new_address text NOT NULL,
  new_lat double precision NOT NULL,
  new_lng double precision NOT NULL,
  reason text,
  status public.approval_status NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.store_relocation_requests TO authenticated;
GRANT ALL ON public.store_relocation_requests TO service_role;
ALTER TABLE public.store_relocation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reloc seller read" ON public.store_relocation_requests FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));
CREATE POLICY "reloc seller insert" ON public.store_relocation_requests FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));
CREATE POLICY "reloc admin update" ON public.store_relocation_requests FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ROLE REQUESTS (become seller / delivery)
CREATE TABLE public.role_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_role public.app_role NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'PENDING',
  store_name text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  address_line text,
  latitude double precision,
  longitude double precision,
  id_doc_type text,
  id_doc_number text,
  vehicle_number text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.role_requests TO authenticated;
GRANT ALL ON public.role_requests TO service_role;
ALTER TABLE public.role_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role req own read" ON public.role_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "role req own insert" ON public.role_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "role req admin update" ON public.role_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRODUCTS
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  mrp numeric,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  unit_qty numeric NOT NULL DEFAULT 1,
  stock_qty numeric NOT NULL DEFAULT 0,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT USING (true);
CREATE POLICY "products seller write" ON public.products FOR ALL TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.seller_id = auth.uid()));

-- CUSTOMER ADDRESSES
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  address_type text NOT NULL DEFAULT 'HOME',
  house_flat_no text NOT NULL DEFAULT '',
  street_area text NOT NULL DEFAULT '',
  landmark text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addr own all" ON public.customer_addresses FOR ALL TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin()) WITH CHECK (customer_id = auth.uid());

-- DELIVERY PROFILES
CREATE TABLE public.delivery_profiles (
  user_id uuid PRIMARY KEY,
  is_online boolean NOT NULL DEFAULT false,
  vehicle_number text,
  cash_in_hand numeric NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  current_lat double precision,
  current_lng double precision,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.delivery_profiles TO authenticated;
GRANT ALL ON public.delivery_profiles TO service_role;
ALTER TABLE public.delivery_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dp own all" ON public.delivery_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ORDERS
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE DEFAULT ('MN' || to_char(now(),'YYMMDD') || lpad((floor(random()*100000))::text, 5, '0')),
  customer_id uuid NOT NULL,
  address_id uuid REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  delivery_boy_id uuid,
  status public.order_status NOT NULL DEFAULT 'PLACED',
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_charge numeric NOT NULL DEFAULT 0,
  platform_fee numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'COD',
  coupon_code text,
  otp text NOT NULL DEFAULT lpad((floor(random()*10000))::text, 4, '0'),
  distance_km numeric NOT NULL DEFAULT 0,
  is_multi_pickup boolean NOT NULL DEFAULT false,
  delivery_earning numeric NOT NULL DEFAULT 0,
  prep_time_min int,
  delivery_address text NOT NULL DEFAULT '',
  delivery_lat double precision,
  delivery_lng double precision,
  placed_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit_label text NOT NULL DEFAULT '',
  unit_price numeric NOT NULL DEFAULT 0,
  qty numeric NOT NULL DEFAULT 1,
  line_total numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_see_order(_order_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _order_id
      AND (
        o.customer_id = auth.uid()
        OR o.delivery_boy_id = auth.uid()
        OR public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.order_items oi
          JOIN public.stores s ON s.id = oi.store_id
          WHERE oi.order_id = o.id AND s.seller_id = auth.uid()
        )
        OR (o.delivery_boy_id IS NULL AND o.status IN ('READY','ACCEPTED','PREPARING')
            AND public.has_role(auth.uid(), 'DELIVERY'))
      )
  );
$$;

CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (public.can_see_order(id));
CREATE POLICY "orders customer insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "orders update parties" ON public.orders FOR UPDATE TO authenticated
  USING (public.can_see_order(id)) WITH CHECK (public.can_see_order(id));

CREATE POLICY "order items read" ON public.order_items FOR SELECT TO authenticated USING (public.can_see_order(order_id));
CREATE POLICY "order items insert" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid()));

-- DELIVERY LOCATION LOGS
CREATE TABLE public.delivery_location_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_boy_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  speed numeric,
  heading numeric,
  battery_level numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.delivery_location_logs TO authenticated;
GRANT ALL ON public.delivery_location_logs TO service_role;
ALTER TABLE public.delivery_location_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs insert own" ON public.delivery_location_logs FOR INSERT TO authenticated WITH CHECK (delivery_boy_id = auth.uid());
CREATE POLICY "logs read parties" ON public.delivery_location_logs FOR SELECT TO authenticated
  USING (delivery_boy_id = auth.uid() OR public.is_admin() OR (order_id IS NOT NULL AND public.can_see_order(order_id)));

-- COUPONS
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'PERCENT',
  discount_value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons public read" ON public.coupons FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "coupons admin write" ON public.coupons FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- SYSTEM SETTINGS
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "settings admin write" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- REALTIME
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.delivery_location_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_location_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_requests;

-- SEED
INSERT INTO public.units (name, short_name) VALUES
 ('Kilogram','kg'),('Piece','pcs'),('Litre','ltr'),('Darjan','darjan'),('Gram','gm'),('Packet','pkt');

INSERT INTO public.categories (name, icon, commission_pct, sort_order) VALUES
 ('Ration','Wheat',8,1),
 ('Sabji','Carrot',10,2),
 ('Meat','Drumstick',12,3),
 ('Fruits','Apple',10,4),
 ('Kapda','Shirt',15,5),
 ('Jewellery','Gem',18,6),
 ('Kitchen','CookingPot',12,7);

INSERT INTO public.system_settings (key, value, description) VALUES
 ('delivery_slabs','[{"max_km":3,"charge":20},{"max_km":6,"charge":35},{"max_km":9,"charge":50},{"max_km":12,"charge":70}]','Distance based delivery charges'),
 ('platform_fee','{"amount":5}','Flat platform fee per order'),
 ('cod_cash_limit','{"amount":3000}','Max cash a delivery partner can hold'),
 ('multi_pickup_bonus','{"amount":25}','Bonus for 2-store batched pickup'),
 ('delivery_base_pay','{"amount":30}','Base pay per delivery'),
 ('surge','{"active":false,"multiplier":1.0}','Surge pricing'),
 ('max_batch_radius_km','{"value":12}','Max radius for multi-store batching'),
 ('free_delivery_above','{"amount":499}','Free delivery threshold');

INSERT INTO public.coupons (code, discount_type, discount_value, min_order, max_discount) VALUES
 ('MANNU50','PERCENT',10,199,50),
 ('FIRST30','FLAT',30,149,NULL);

WITH cat AS (SELECT id, name FROM public.categories)
INSERT INTO public.stores (store_name, category_id, address_line, latitude, longitude, phone, rating)
SELECT * FROM (VALUES
 ('Suraj Kirana Bhandar', (SELECT id FROM cat WHERE name='Ration'), 'Main Road, Kadru, Ranchi', 23.3403, 85.3245, '9430011122', 4.5),
 ('Lalpur Sabji Mandi', (SELECT id FROM cat WHERE name='Sabji'), 'Lalpur Chowk, Ranchi', 23.3765, 85.3320, '9430011133', 4.2),
 ('Ranchi Fresh Meat', (SELECT id FROM cat WHERE name='Meat'), 'Hinoo, Ranchi', 23.3288, 85.3311, '9430011144', 4.1),
 ('Doranda Fruit Corner', (SELECT id FROM cat WHERE name='Fruits'), 'Doranda Market, Ranchi', 23.3357, 85.3172, '9430011155', 4.6),
 ('Mannu Kapda Ghar', (SELECT id FROM cat WHERE name='Kapda'), 'Upper Bazar, Ranchi', 23.3556, 85.3260, '9430011166', 4.0),
 ('Kitchen Wale', (SELECT id FROM cat WHERE name='Kitchen'), 'Bariatu Road, Ranchi', 23.3860, 85.3300, '9430011177', 4.4)
) AS v;

WITH s AS (SELECT id, store_name FROM public.stores), u AS (SELECT id, short_name FROM public.units)
INSERT INTO public.products (store_id, product_name, price, mrp, unit_id, unit_qty, stock_qty, description)
SELECT * FROM (VALUES
 ((SELECT id FROM s WHERE store_name='Suraj Kirana Bhandar'),'Aashirvaad Atta',260,299,(SELECT id FROM u WHERE short_name='kg'),5,40,'Whole wheat flour 5kg pack'),
 ((SELECT id FROM s WHERE store_name='Suraj Kirana Bhandar'),'Sona Masoori Rice',420,480,(SELECT id FROM u WHERE short_name='kg'),10,25,'Premium rice 10kg'),
 ((SELECT id FROM s WHERE store_name='Suraj Kirana Bhandar'),'Fortune Sunflower Oil',150,165,(SELECT id FROM u WHERE short_name='ltr'),1,60,'Refined oil 1L'),
 ((SELECT id FROM s WHERE store_name='Suraj Kirana Bhandar'),'Tata Salt',26,30,(SELECT id FROM u WHERE short_name='kg'),1,100,'Iodised salt'),
 ((SELECT id FROM s WHERE store_name='Lalpur Sabji Mandi'),'Aloo (Potato)',28,35,(SELECT id FROM u WHERE short_name='kg'),1,150,'Fresh local potato'),
 ((SELECT id FROM s WHERE store_name='Lalpur Sabji Mandi'),'Pyaaz (Onion)',34,40,(SELECT id FROM u WHERE short_name='kg'),1,120,'Nashik onion'),
 ((SELECT id FROM s WHERE store_name='Lalpur Sabji Mandi'),'Tamatar (Tomato)',30,38,(SELECT id FROM u WHERE short_name='kg'),1,90,'Farm fresh tomato'),
 ((SELECT id FROM s WHERE store_name='Lalpur Sabji Mandi'),'Palak Bunch',15,20,(SELECT id FROM u WHERE short_name='pcs'),1,40,'Fresh spinach bunch'),
 ((SELECT id FROM s WHERE store_name='Ranchi Fresh Meat'),'Chicken Curry Cut',210,240,(SELECT id FROM u WHERE short_name='kg'),1,30,'Fresh cut chicken'),
 ((SELECT id FROM s WHERE store_name='Ranchi Fresh Meat'),'Mutton Boneless',720,780,(SELECT id FROM u WHERE short_name='kg'),1,12,'Tender goat meat'),
 ((SELECT id FROM s WHERE store_name='Ranchi Fresh Meat'),'Desi Anda',84,90,(SELECT id FROM u WHERE short_name='darjan'),1,50,'Farm eggs per dozen'),
 ((SELECT id FROM s WHERE store_name='Doranda Fruit Corner'),'Kela (Banana)',48,55,(SELECT id FROM u WHERE short_name='darjan'),1,60,'Ripe bananas'),
 ((SELECT id FROM s WHERE store_name='Doranda Fruit Corner'),'Shimla Apple',180,210,(SELECT id FROM u WHERE short_name='kg'),1,35,'Crisp red apples'),
 ((SELECT id FROM s WHERE store_name='Doranda Fruit Corner'),'Papita (Papaya)',45,55,(SELECT id FROM u WHERE short_name='kg'),1,25,'Sweet papaya'),
 ((SELECT id FROM s WHERE store_name='Mannu Kapda Ghar'),'Cotton Kurta',649,899,(SELECT id FROM u WHERE short_name='pcs'),1,20,'Handloom cotton kurta'),
 ((SELECT id FROM s WHERE store_name='Mannu Kapda Ghar'),'Saree Cotton Print',999,1499,(SELECT id FROM u WHERE short_name='pcs'),1,15,'Printed cotton saree'),
 ((SELECT id FROM s WHERE store_name='Kitchen Wale'),'Steel Kadhai',549,699,(SELECT id FROM u WHERE short_name='pcs'),1,18,'Triply steel kadhai'),
 ((SELECT id FROM s WHERE store_name='Kitchen Wale'),'Pressure Cooker 3L',1299,1599,(SELECT id FROM u WHERE short_name='pcs'),1,10,'ISI marked cooker')
) AS v;
