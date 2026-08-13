CREATE TABLE IF NOT EXISTS public.store_contacts (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_contacts TO authenticated;
GRANT ALL ON public.store_contacts TO service_role;

ALTER TABLE public.store_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store contacts owner read" ON public.store_contacts
  FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_contacts.store_id AND s.seller_id = auth.uid()));

CREATE POLICY "store contacts owner write" ON public.store_contacts
  FOR ALL TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_contacts.store_id AND s.seller_id = auth.uid()))
  WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_contacts.store_id AND s.seller_id = auth.uid()));

INSERT INTO public.store_contacts (store_id, phone)
SELECT id, phone FROM public.stores WHERE phone IS NOT NULL
ON CONFLICT (store_id) DO NOTHING;

ALTER TABLE public.stores DROP COLUMN IF EXISTS phone;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;