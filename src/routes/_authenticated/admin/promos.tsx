import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/promos")({
  head: () => ({
    meta: [
      { title: "Coupons & Banners — Mannu Admin" },
      { name: "description", content: "Create discount coupons and manage homepage promotional banners for the storefront." },
      { property: "og:title", content: "Coupons & Banners — Mannu Admin" },
      { property: "og:description", content: "Run offers and promotions across Mannu A2Z Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Promos,
});

function Promos() {
  const qc = useQueryClient();
  const [coupon, setCoupon] = useState({ code: "", discount_type: "PERCENT", discount_value: "10", min_order: "199", max_discount: "" });
  const [banner, setBanner] = useState({ title: "", subtitle: "", image_url: "", link_url: "" });

  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: banners } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [],
  });

  async function run(p: PromiseLike<{ error: { message: string } | null }>, key: string, msg: string) {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: [key] });
  }

  return (
    <AdminLayout title="Coupons & Banners" subtitle="Offers and homepage promotions">
      <Tabs defaultValue="coupons">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-32" placeholder="CODE" value={coupon.code} onChange={(e) => setCoupon((c) => ({ ...c, code: e.target.value.toUpperCase() }))} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCoupon((c) => ({ ...c, discount_type: c.discount_type === "PERCENT" ? "FLAT" : "PERCENT" }))}
              >
                {coupon.discount_type}
              </Button>
              <Input className="w-24" type="number" placeholder="Value" value={coupon.discount_value} onChange={(e) => setCoupon((c) => ({ ...c, discount_value: e.target.value }))} />
              <Input className="w-28" type="number" placeholder="Min order" value={coupon.min_order} onChange={(e) => setCoupon((c) => ({ ...c, min_order: e.target.value }))} />
              <Input className="w-28" type="number" placeholder="Max disc." value={coupon.max_discount} onChange={(e) => setCoupon((c) => ({ ...c, max_discount: e.target.value }))} />
              <Button
                size="sm"
                onClick={() => {
                  if (!coupon.code.trim()) {
                    toast.error("Enter a coupon code");
                    return;
                  }
                  void run(
                    supabase.from("coupons").insert({
                      code: coupon.code.trim(),
                      discount_type: coupon.discount_type,
                      discount_value: Number(coupon.discount_value) || 0,
                      min_order: Number(coupon.min_order) || 0,
                      max_discount: coupon.max_discount ? Number(coupon.max_discount) : null,
                    }),
                    "admin-coupons",
                    "Coupon created",
                  );
                  setCoupon({ code: "", discount_type: "PERCENT", discount_value: "10", min_order: "199", max_discount: "" });
                }}
              >
                Add coupon
              </Button>
            </div>
          </AdminCard>

          {(coupons ?? []).map((c) => (
            <AdminCard key={c.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display font-bold">{c.code}</span>
                <span className="text-xs text-muted-foreground">
                  {c.discount_type === "PERCENT" ? `${c.discount_value}% off` : `${inr(Number(c.discount_value))} off`} · min {inr(Number(c.min_order))}
                  {c.max_discount ? ` · max ${inr(Number(c.max_discount))}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => void run(supabase.from("coupons").update({ is_active: v }).eq("id", c.id), "admin-coupons", "Coupon updated")}
                  />
                  <Button size="icon" variant="ghost" onClick={() => void run(supabase.from("coupons").delete().eq("id", c.id), "admin-coupons", "Coupon deleted")}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        <TabsContent value="banners" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <Input className="w-40" placeholder="Title" value={banner.title} onChange={(e) => setBanner((b) => ({ ...b, title: e.target.value }))} />
              <Input className="w-40" placeholder="Subtitle" value={banner.subtitle} onChange={(e) => setBanner((b) => ({ ...b, subtitle: e.target.value }))} />
              <Input className="w-56" placeholder="Image URL" value={banner.image_url} onChange={(e) => setBanner((b) => ({ ...b, image_url: e.target.value }))} />
              <Input className="w-40" placeholder="Link (/store/...)" value={banner.link_url} onChange={(e) => setBanner((b) => ({ ...b, link_url: e.target.value }))} />
              <Button
                size="sm"
                onClick={() => {
                  if (!banner.title.trim()) {
                    toast.error("Enter a banner title");
                    return;
                  }
                  void run(
                    supabase.from("banners").insert({
                      title: banner.title.trim(),
                      subtitle: banner.subtitle || null,
                      image_url: banner.image_url || null,
                      link_url: banner.link_url || null,
                      sort_order: (banners?.length ?? 0) + 1,
                    }),
                    "admin-banners",
                    "Banner added",
                  );
                  setBanner({ title: "", subtitle: "", image_url: "", link_url: "" });
                }}
              >
                Add banner
              </Button>
            </div>
          </AdminCard>

          {(banners ?? []).map((b) => (
            <AdminCard key={b.id}>
              <div className="flex items-center gap-3">
                {b.image_url ? (
                  <img src={b.image_url} alt={b.title} className="size-12 rounded-xl object-cover" loading="lazy" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.subtitle ?? b.link_url ?? ""}</p>
                </div>
                <Switch
                  checked={b.is_active}
                  onCheckedChange={(v) => void run(supabase.from("banners").update({ is_active: v }).eq("id", b.id), "admin-banners", "Banner updated")}
                />
                <Button size="icon" variant="ghost" onClick={() => void run(supabase.from("banners").delete().eq("id", b.id), "admin-banners", "Banner deleted")}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </AdminCard>
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}