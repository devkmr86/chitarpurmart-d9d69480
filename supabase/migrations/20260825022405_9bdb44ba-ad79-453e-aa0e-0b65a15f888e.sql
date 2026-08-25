ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS shop_type_id uuid REFERENCES public.shop_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS categories_shop_type_idx ON public.categories(shop_type_id);
CREATE INDEX IF NOT EXISTS categories_parent_idx ON public.categories(parent_id);

CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  user_id uuid,
  note text,
  status text NOT NULL DEFAULT 'PENDING',
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_requests TO authenticated;
GRANT INSERT ON public.password_reset_requests TO anon;
GRANT ALL ON public.password_reset_requests TO service_role;

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create a reset request"
  ON public.password_reset_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view reset requests"
  ON public.password_reset_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update reset requests"
  ON public.password_reset_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete reset requests"
  ON public.password_reset_requests FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_password_reset_requests_updated_at
  BEFORE UPDATE ON public.password_reset_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();