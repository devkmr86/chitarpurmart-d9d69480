CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  unit_id uuid REFERENCES public.units(id),
  unit_qty numeric NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  mrp numeric,
  stock_qty numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_variants_product_id_idx ON public.product_variants(product_id);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view variants"
ON public.product_variants FOR SELECT
USING (true);

CREATE POLICY "Sellers manage own product variants"
ON public.product_variants FOR ALL
TO authenticated
USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.seller_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_variants.product_id AND s.seller_id = auth.uid()
  )
);

CREATE TRIGGER update_product_variants_updated_at
BEFORE UPDATE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();