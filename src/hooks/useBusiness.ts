import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BusinessSettings = {
  id: string;
  brand_name: string;
  tagline: string;
  fssai_number: string | null;
  udyam_number: string | null;
  support_phone: string | null;
  support_email: string | null;
  upi_id: string | null;
  qr_image_url: string | null;
  base_delivery_charge: number;
  per_km_rate: number;
  commission_pct: number;
  min_payout_limit: number;
  about_text: string | null;
};

export const DEFAULT_TAGLINE = "Aapke ghar ki digital dukan";

/** Live platform-wide business settings managed by the Super Admin. */
export function useBusiness() {
  const { data } = useQuery({
    queryKey: ["business-settings"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("business_settings").select("*").limit(1).maybeSingle();
      return (data as BusinessSettings | null) ?? null;
    },
  });
  return {
    business: data,
    tagline: data?.tagline?.trim() || DEFAULT_TAGLINE,
    brand: data?.brand_name?.trim() || "Mannu A2Z Mart",
  };
}

/** Builds a UPI deep link for cash settlement / online payment. */
export function upiIntent(opts: {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}) {
  const p = new URLSearchParams({
    pa: opts.upiId,
    pn: opts.name,
    am: String(Math.max(0, Math.round(opts.amount * 100) / 100)),
    cu: "INR",
  });
  if (opts.note) p.set("tn", opts.note.slice(0, 40));
  return `upi://pay?${p.toString()}`;
}
