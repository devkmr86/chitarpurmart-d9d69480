import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { ImageUpload, MoneyInput } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logAdminAction } from "@/lib/admin-audit";
import { reviewRoleRequest } from "@/lib/mannu.functions";

export const Route = createFileRoute("/_authenticated/admin/business")({
  head: () => ({
    meta: [
      { title: "Business Command Center — Mannu Admin" },
      { name: "description", content: "Manage FSSAI, Udyam, UPI QR, delivery pricing, commission and store verification for Mannu A2Z Mart." },
      { property: "og:title", content: "Business Command Center — Mannu Admin" },
      { property: "og:description", content: "One dashboard for legal details, payments and verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BusinessCenter,
});

const UNITS = ["Kg", "Gram", "Darjan", "Pcs", "Litre", "Plate"];
const ATTRS: Array<{ key: string; label: string }> = [
  { key: "sizes", label: "Sizes" },
  { key: "colors", label: "Colors" },
  { key: "veg_badge", label: "Pure Veg / Non-Veg badge" },
];

type Form = {
  brand_name: string;
  tagline: string;
  fssai_number: string;
  udyam_number: string;
  support_phone: string;
  support_email: string;
  upi_id: string;
  qr_image_url: string | null;
  base_delivery_charge: string;
  per_km_rate: string;
  commission_pct: string;
  min_payout_limit: string;
  about_text: string;
};

const EMPTY: Form = {
  brand_name: "Mannu A2Z Mart",
  tagline: "Aapke ghar ki digital dukan",
  fssai_number: "",
  udyam_number: "",
  support_phone: "",
  support_email: "",
  upi_id: "",
  qr_image_url: null,
  base_delivery_charge: "20",
  per_km_rate: "8",
  commission_pct: "10",
  min_payout_limit: "200",
  about_text: "",
};

function BusinessCenter() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const review = useServerFn(reviewRoleRequest);

  const { data: row } = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () =>
      (await supabase.from("business_settings").select("*").limit(1).maybeSingle()).data,
  });

  const { data: pending } = useQuery({
    queryKey: ["admin-pending-sellers"],
    refetchInterval: 20000,
    queryFn: async () =>
      (
        await supabase
          .from("role_requests")
          .select("*, categories(name)")
          .eq("requested_role", "SELLER")
          .eq("status", "PENDING")
          .order("created_at")
      ).data ?? [],
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-store-verification"],
    queryFn: async () =>
      (await supabase.from("stores").select("id,store_name,fssai_number,is_verified").order("store_name")).data ?? [],
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-category-rules"],
    queryFn: async () =>
      (await supabase.from("categories").select("id,name,allowed_units,attributes").order("sort_order")).data ?? [],
  });

  useEffect(() => {
    if (!row) return;
    setForm({
      brand_name: row.brand_name,
      tagline: row.tagline,
      fssai_number: row.fssai_number ?? "",
      udyam_number: row.udyam_number ?? "",
      support_phone: row.support_phone ?? "",
      support_email: row.support_email ?? "",
      upi_id: row.upi_id ?? "",
      qr_image_url: row.qr_image_url,
      base_delivery_charge: String(row.base_delivery_charge),
      per_km_rate: String(row.per_km_rate),
      commission_pct: String(row.commission_pct),
      min_payout_limit: String(row.min_payout_limit),
      about_text: row.about_text ?? "",
    });
  }, [row]);

  async function save() {
    if (form.fssai_number && !/^\d{14}$/.test(form.fssai_number)) {
      toast.error("FSSAI number must be exactly 14 digits");
      return;
    }
    if (!row) return;
    setSaving(true);
    const { error } = await supabase
      .from("business_settings")
      .update({
        brand_name: form.brand_name.trim() || "Mannu A2Z Mart",
        tagline: form.tagline.trim() || "Aapke ghar ki digital dukan",
        fssai_number: form.fssai_number.trim() || null,
        udyam_number: form.udyam_number.trim() || null,
        support_phone: form.support_phone.trim() || null,
        support_email: form.support_email.trim() || null,
        upi_id: form.upi_id.trim() || null,
        qr_image_url: form.qr_image_url,
        base_delivery_charge: Number(form.base_delivery_charge) || 0,
        per_km_rate: Number(form.per_km_rate) || 0,
        commission_pct: Number(form.commission_pct) || 0,
        min_payout_limit: Number(form.min_payout_limit) || 0,
        about_text: form.about_text.trim() || null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Business settings saved — live across the app");
    void logAdminAction("UPDATE", "business_settings", row.id, {});
    void qc.invalidateQueries({ queryKey: ["business-settings"] });
  }

  async function decide(id: string, approve: boolean) {
    try {
      await review({ data: { requestId: id, approve } });
      toast.success(approve ? "Store approve ho gayi" : "Application reject ho gayi");
      void qc.invalidateQueries({ queryKey: ["admin-pending-sellers"] });
      void qc.invalidateQueries({ queryKey: ["admin-store-verification"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleVerified(id: string, v: boolean) {
    const { error } = await supabase.from("stores").update({ is_verified: v }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void logAdminAction(v ? "VERIFY" : "UNVERIFY", "stores", id, {});
    void qc.invalidateQueries({ queryKey: ["admin-store-verification"] });
  }

  async function saveRules(
    id: string,
    allowed: string[],
    attributes: Record<string, boolean>,
  ) {
    const { error } = await supabase
      .from("categories")
      .update({ allowed_units: allowed as never, attributes: attributes as never })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["admin-category-rules"] });
  }

  const set = (k: keyof Form, v: string | null) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminLayout
      title="Business Command Center"
      subtitle="Legal details, payment QR, pricing rules and store verification"
      actions={
        <Button onClick={() => void save()} disabled={saving}>
          Save
        </Button>
      }
    >
      <Tabs defaultValue="legal">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="legal">Brand & legal</TabsTrigger>
          <TabsTrigger value="payment">Payment & QR</TabsTrigger>
          <TabsTrigger value="pricing">Delivery & commission</TabsTrigger>
          <TabsTrigger value="verify">Store verification</TabsTrigger>
          <TabsTrigger value="rules">Category rules</TabsTrigger>
        </TabsList>

        <TabsContent value="legal" className="mt-4 grid gap-3 lg:grid-cols-2">
          <AdminCard className="space-y-3">
            <p className="font-semibold">Brand identity</p>
            <div>
              <Label className="text-xs">Platform name</Label>
              <Input value={form.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tagline / slogan</Label>
              <Input value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Shown under headers, in menus and on invoices.
              </p>
            </div>
            <div>
              <Label className="text-xs">About us text</Label>
              <Textarea
                rows={4}
                value={form.about_text}
                onChange={(e) => set("about_text", e.target.value)}
              />
            </div>
          </AdminCard>

          <AdminCard className="space-y-3">
            <p className="font-semibold">Legal & regulatory</p>
            <div>
              <Label className="text-xs">Platform FSSAI number (14 digits)</Label>
              <Input
                inputMode="numeric"
                maxLength={14}
                value={form.fssai_number}
                onChange={(e) => set("fssai_number", e.target.value.replace(/\D/g, ""))}
                placeholder="12345678901234"
              />
            </div>
            <div>
              <Label className="text-xs">Udyam / MSME registration number</Label>
              <Input
                value={form.udyam_number}
                onChange={(e) => set("udyam_number", e.target.value.toUpperCase())}
                placeholder="UDYAM-JH-00-0000000"
              />
            </div>
            <div>
              <Label className="text-xs">Support phone</Label>
              <Input value={form.support_phone} onChange={(e) => set("support_phone", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Support email</Label>
              <Input value={form.support_email} onChange={(e) => set("support_email", e.target.value)} />
            </div>
          </AdminCard>
        </TabsContent>

        <TabsContent value="payment" className="mt-4 grid gap-3 lg:grid-cols-2">
          <AdminCard className="space-y-3">
            <p className="font-semibold">Official platform UPI</p>
            <div>
              <Label className="text-xs">UPI ID</Label>
              <Input
                value={form.upi_id}
                onChange={(e) => set("upi_id", e.target.value)}
                placeholder="mannumart@okicici"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Used on customer online payment, rider doorstep QR collection and rider cash
              settlement screens.
            </p>
          </AdminCard>
          <AdminCard className="space-y-3">
            <p className="font-semibold">Business QR code</p>
            <ImageUpload
              value={form.qr_image_url}
              onChange={(url) => set("qr_image_url", url)}
              folder="business-qr"
              label="Upload QR image"
            />
          </AdminCard>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4 grid gap-3 lg:grid-cols-2">
          <AdminCard className="space-y-3">
            <p className="font-semibold">Delivery pricing</p>
            <div>
              <Label className="text-xs">Base delivery charge</Label>
              <MoneyInput value={form.base_delivery_charge} onChange={(v) => set("base_delivery_charge", v)} />
            </div>
            <div>
              <Label className="text-xs">Per-KM rate</Label>
              <MoneyInput value={form.per_km_rate} onChange={(v) => set("per_km_rate", v)} />
            </div>
          </AdminCard>
          <AdminCard className="space-y-3">
            <p className="font-semibold">Commission & payouts</p>
            <div>
              <Label className="text-xs">Platform commission %</Label>
              <Input
                type="number"
                value={form.commission_pct}
                onChange={(e) => set("commission_pct", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Minimum payout limit</Label>
              <MoneyInput value={form.min_payout_limit} onChange={(v) => set("min_payout_limit", v)} />
            </div>
          </AdminCard>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
