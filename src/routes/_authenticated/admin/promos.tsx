import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { ImageUpload, MoneyInput } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logAdminAction } from "@/lib/admin-audit";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/promos")({
  head: () => ({
    meta: [
      { title: "Offers & Banners — Mannu Admin" },
      { name: "description", content: "Create customer coupons, seller commission offers, rider incentives and upload homepage banners." },
      { property: "og:title", content: "Offers & Banners — Mannu Admin" },
      { property: "og:description", content: "Run role-wise offers and promotions across Mannu A2Z Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Promos,
});

function Promos() {
  const qc = useQueryClient();
  const [coupon, setCoupon] = useState({
    code: "",
    discount_type: "PERCENT",
    discount_value: "10",
    min_order: "199",
    max_discount: "",
    expires_at: "",
  });
  const [banner, setBanner] = useState<{ title: string; subtitle: string; image_url: string | null; link_url: string }>({
    title: "",
    subtitle: "",
    image_url: null,
    link_url: "",
  });
  const [offer, setOffer] = useState({ store_id: "", promo_commission_pct: "5", ends_at: "", note: "" });
  const [incentive, setIncentive] = useState({ title: "", orders_required: "10", bonus_amount: "150", period: "DAILY" });

  const { data: coupons } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => (await supabase.from("coupons").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: banners } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [],
  });
  const { data: stores } = useQuery({
    queryKey: ["admin-store-options"],
    queryFn: async () => (await supabase.from("stores").select("id,store_name").order("store_name")).data ?? [],
  });
  const { data: offers } = useQuery({
    queryKey: ["admin-seller-offers"],
    queryFn: async () =>
      (await supabase.from("seller_offers").select("*,stores(store_name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: incentives } = useQuery({
    queryKey: ["admin-incentives"],
    queryFn: async () =>
      (await supabase.from("delivery_incentives").select("*").order("orders_required")).data ?? [],
  });

  async function run(
    p: PromiseLike<{ error: { message: string } | null }>,
    key: string,
    msg: string,
    audit?: { action: string; entity: string },
  ) {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    if (audit) void logAdminAction(audit.action, audit.entity, null, {});
    void qc.invalidateQueries({ queryKey: [key] });
  }

  return (
    <AdminLayout title="Offers & Banners" subtitle="Coupons, seller offers, rider incentives and banners">
      <Tabs defaultValue="coupons">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="coupons">Customer coupons</TabsTrigger>
          <TabsTrigger value="sellers">Seller offers</TabsTrigger>
          <TabsTrigger value="riders">Rider incentives</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>

        {/* COUPONS */}
        <TabsContent value="coupons" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Code</Label>
                <Input className="w-36" placeholder="MANNU50" value={coupon.code} onChange={(e) => setCoupon((c) => ({ ...c, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={coupon.discount_type} onValueChange={(v) => setCoupon((c) => ({ ...c, discount_type: v }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percent %</SelectItem>
                    <SelectItem value="FLAT">Flat ₹</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input className="w-24" type="number" value={coupon.discount_value} onChange={(e) => setCoupon((c) => ({ ...c, discount_value: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Min order</Label>
                <MoneyInput className="w-32" value={coupon.min_order} onChange={(v) => setCoupon((c) => ({ ...c, min_order: v }))} />
              </div>
              <div>
                <Label className="text-xs">Max discount</Label>
                <MoneyInput className="w-32" value={coupon.max_discount} onChange={(v) => setCoupon((c) => ({ ...c, max_discount: v }))} />
              </div>
              <div>
                <Label className="text-xs">Expiry</Label>
                <Input className="w-44" type="date" value={coupon.expires_at} onChange={(e) => setCoupon((c) => ({ ...c, expires_at: e.target.value }))} />
              </div>
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
                      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString() : null,
                    }),
                    "admin-coupons",
                    "Coupon created",
                    { action: "CREATE", entity: "coupons" },
                  );
                  setCoupon({ code: "", discount_type: "PERCENT", discount_value: "10", min_order: "199", max_discount: "", expires_at: "" });
                }}
              >
                Add coupon
              </Button>
            </div>
          </AdminCard>

          {(coupons ?? []).map((c) => (
            <AdminCard key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-bold">{c.code}</span>
                <Input
                  className="w-24"
                  type="number"
                  defaultValue={String(c.discount_value)}
                  onBlur={(e) =>
                    void run(
                      supabase.from("coupons").update({ discount_value: Number(e.target.value) || 0 }).eq("id", c.id),
                      "admin-coupons",
                      "Coupon updated",
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">{c.discount_type === "PERCENT" ? "%" : "₹ flat"}</span>
                <MoneyInput
                  className="w-32"
                  value={String(c.min_order)}
                  onChange={(v) =>
                    void run(
                      supabase.from("coupons").update({ min_order: Number(v) || 0 }).eq("id", c.id),
                      "admin-coupons",
                      "Minimum order updated",
                    )
                  }
                />
                <MoneyInput
                  className="w-32"
                  value={c.max_discount != null ? String(c.max_discount) : ""}
                  onChange={(v) =>
                    void run(
                      supabase.from("coupons").update({ max_discount: v === "" ? null : Number(v) }).eq("id", c.id),
                      "admin-coupons",
                      "Max discount updated",
                    )
                  }
                />
                <Input
                  className="w-40"
                  type="date"
                  defaultValue={c.expires_at ? String(c.expires_at).slice(0, 10) : ""}
                  onChange={(e) =>
                    void run(
                      supabase
                        .from("coupons")
                        .update({ expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })
                        .eq("id", c.id),
                      "admin-coupons",
                      "Expiry updated",
                    )
                  }
                />
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) => void run(supabase.from("coupons").update({ is_active: v }).eq("id", c.id), "admin-coupons", "Coupon updated")}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(supabase.from("coupons").delete().eq("id", c.id), "admin-coupons", "Coupon deleted", {
                        action: "DELETE",
                        entity: "coupons",
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        {/* SELLER OFFERS */}
        <TabsContent value="sellers" className="mt-4 space-y-3">
          <AdminCard>
            <p className="mb-2 font-semibold">Temporary reduced commission</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Store</Label>
                <Select value={offer.store_id} onValueChange={(v) => setOffer((o) => ({ ...o, store_id: v }))}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {(stores ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Promo commission %</Label>
                <Input className="w-28" type="number" value={offer.promo_commission_pct} onChange={(e) => setOffer((o) => ({ ...o, promo_commission_pct: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Ends on</Label>
                <Input className="w-44" type="date" value={offer.ends_at} onChange={(e) => setOffer((o) => ({ ...o, ends_at: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Note</Label>
                <Input className="w-48" value={offer.note} onChange={(e) => setOffer((o) => ({ ...o, note: e.target.value }))} />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!offer.store_id) {
                    toast.error("Select a store");
                    return;
                  }
                  void run(
                    supabase.from("seller_offers").insert({
                      store_id: offer.store_id,
                      promo_commission_pct: Number(offer.promo_commission_pct) || 0,
                      ends_at: offer.ends_at ? new Date(offer.ends_at).toISOString() : null,
                      note: offer.note || null,
                    }),
                    "admin-seller-offers",
                    "Seller offer created",
                    { action: "CREATE", entity: "seller_offers" },
                  );
                  setOffer({ store_id: "", promo_commission_pct: "5", ends_at: "", note: "" });
                }}
              >
                Add offer
              </Button>
            </div>
          </AdminCard>

          {(offers ?? []).map((o) => (
            <AdminCard key={o.id}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{(o.stores as { store_name?: string } | null)?.store_name ?? "Store"}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(o.promo_commission_pct)}% commission
                    {o.ends_at ? ` · till ${new Date(o.ends_at).toLocaleDateString("en-IN")}` : ""}
                    {o.note ? ` · ${o.note}` : ""}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    className="w-24"
                    type="number"
                    defaultValue={String(o.promo_commission_pct)}
                    onBlur={(e) =>
                      void run(
                        supabase.from("seller_offers").update({ promo_commission_pct: Number(e.target.value) || 0 }).eq("id", o.id),
                        "admin-seller-offers",
                        "Offer updated",
                      )
                    }
                  />
                  <Switch
                    checked={o.is_active}
                    onCheckedChange={(v) =>
                      void run(supabase.from("seller_offers").update({ is_active: v }).eq("id", o.id), "admin-seller-offers", "Offer updated")
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(supabase.from("seller_offers").delete().eq("id", o.id), "admin-seller-offers", "Offer removed", {
                        action: "DELETE",
                        entity: "seller_offers",
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        {/* RIDER INCENTIVES */}
        <TabsContent value="riders" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="w-52" placeholder="Weekend hustle bonus" value={incentive.title} onChange={(e) => setIncentive((i) => ({ ...i, title: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Orders required</Label>
                <Input className="w-28" type="number" value={incentive.orders_required} onChange={(e) => setIncentive((i) => ({ ...i, orders_required: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Bonus</Label>
                <MoneyInput className="w-32" value={incentive.bonus_amount} onChange={(v) => setIncentive((i) => ({ ...i, bonus_amount: v }))} />
              </div>
              <div>
                <Label className="text-xs">Period</Label>
                <Select value={incentive.period} onValueChange={(v) => setIncentive((i) => ({ ...i, period: v }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!incentive.title.trim()) {
                    toast.error("Enter an incentive title");
                    return;
                  }
                  void run(
                    supabase.from("delivery_incentives").insert({
                      title: incentive.title.trim(),
                      orders_required: Number(incentive.orders_required) || 0,
                      bonus_amount: Number(incentive.bonus_amount) || 0,
                      period: incentive.period,
                    }),
                    "admin-incentives",
                    "Incentive added",
                    { action: "CREATE", entity: "delivery_incentives" },
                  );
                  setIncentive({ title: "", orders_required: "10", bonus_amount: "150", period: "DAILY" });
                }}
              >
                Add incentive
              </Button>
            </div>
          </AdminCard>

          {(incentives ?? []).map((i) => (
            <AdminCard key={i.id}>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="font-semibold">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.orders_required} orders ({i.period.toLowerCase()}) → {inr(Number(i.bonus_amount))} bonus
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    className="w-24"
                    type="number"
                    defaultValue={String(i.orders_required)}
                    onBlur={(e) =>
                      void run(
                        supabase.from("delivery_incentives").update({ orders_required: Number(e.target.value) || 0 }).eq("id", i.id),
                        "admin-incentives",
                        "Incentive updated",
                      )
                    }
                  />
                  <MoneyInput
                    className="w-32"
                    value={String(i.bonus_amount)}
                    onChange={(v) =>
                      void run(
                        supabase.from("delivery_incentives").update({ bonus_amount: Number(v) || 0 }).eq("id", i.id),
                        "admin-incentives",
                        "Bonus updated",
                      )
                    }
                  />
                  <Switch
                    checked={i.is_active}
                    onCheckedChange={(v) =>
                      void run(supabase.from("delivery_incentives").update({ is_active: v }).eq("id", i.id), "admin-incentives", "Incentive updated")
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(supabase.from("delivery_incentives").delete().eq("id", i.id), "admin-incentives", "Incentive deleted", {
                        action: "DELETE",
                        entity: "delivery_incentives",
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        {/* BANNERS */}
        <TabsContent value="banners" className="mt-4 space-y-3">
          <AdminCard>
            <p className="mb-2 font-semibold">Add banner</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Title</Label>
                <Input className="w-44" value={banner.title} onChange={(e) => setBanner((b) => ({ ...b, title: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Subtitle</Label>
                <Input className="w-44" value={banner.subtitle} onChange={(e) => setBanner((b) => ({ ...b, subtitle: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Link</Label>
                <Input className="w-44" placeholder="/store/..." value={banner.link_url} onChange={(e) => setBanner((b) => ({ ...b, link_url: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3">
              <ImageUpload
                value={banner.image_url}
                folder="banners"
                label="Upload banner image"
                onChange={(url) => setBanner((b) => ({ ...b, image_url: url }))}
              />
            </div>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                if (!banner.title.trim()) {
                  toast.error("Enter a banner title");
                  return;
                }
                void run(
                  supabase.from("banners").insert({
                    title: banner.title.trim(),
                    subtitle: banner.subtitle || null,
                    image_url: banner.image_url,
                    link_url: banner.link_url || null,
                    sort_order: (banners?.length ?? 0) + 1,
                  }),
                  "admin-banners",
                  "Banner added",
                  { action: "CREATE", entity: "banners" },
                );
                setBanner({ title: "", subtitle: "", image_url: null, link_url: "" });
              }}
            >
              Add banner
            </Button>
          </AdminCard>

          {(banners ?? []).map((b) => (
            <AdminCard key={b.id}>
              <div className="flex flex-wrap items-center gap-3">
                <ImageUpload
                  value={b.image_url}
                  folder="banners"
                  onChange={(url) =>
                    void run(supabase.from("banners").update({ image_url: url }).eq("id", b.id), "admin-banners", "Banner image updated")
                  }
                />
                <div className="min-w-0">
                  <Input
                    className="w-44"
                    defaultValue={b.title}
                    onBlur={(e) =>
                      e.target.value !== b.title &&
                      void run(supabase.from("banners").update({ title: e.target.value }).eq("id", b.id), "admin-banners", "Banner updated")
                    }
                  />
                  <p className="mt-1 truncate text-xs text-muted-foreground">{b.subtitle ?? ""}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={(v) => void run(supabase.from("banners").update({ is_active: v }).eq("id", b.id), "admin-banners", "Banner updated")}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(supabase.from("banners").delete().eq("id", b.id), "admin-banners", "Banner deleted", {
                        action: "DELETE",
                        entity: "banners",
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
