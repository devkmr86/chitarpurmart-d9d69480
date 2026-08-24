import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Plus, BellRing, Coffee, IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { PayoutDetails } from "@/components/app/PayoutDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { inr, STATUS_LABEL } from "@/lib/mannu";
import { requestStorePayout } from "@/lib/mannu.functions";
import { useServerFn } from "@tanstack/react-start";
import { startOrderAlarm } from "@/lib/sound";
import {
  VariantManager,
  VariantRepeater,
  draftsToRows,
  emptyVariant,
  type VariantDraft,
} from "@/components/app/VariantManager";

const OOS_KEY = "mannu-oos";

export const Route = createFileRoute("/_authenticated/seller")({
  head: () => ({
    meta: [
      { title: "Seller panel — Mannu A2Z Mart" },
      { name: "description", content: "Manage your store, products, stock and incoming orders." },
      { property: "og:title", content: "Seller panel — Mannu A2Z Mart" },
      { property: "og:description", content: "Run your shop on Mannu A2Z Mart." },
    ],
  }),
  component: SellerPanel,
});

type SellerOrder = {
  id: string;
  order_no: string;
  status: string;
  placed_at: string;
  delivery_address: string;
};
type SellerLine = { product_name: string; qty: number; line_total: number };

const NEXT: Record<string, { to: string; label: string }> = {
  PLACED: { to: "ACCEPTED", label: "Accept order" },
  ACCEPTED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready for pickup" },
};

function SellerPanel() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const payout = useServerFn(requestStorePayout);
  const stopAlarm = useRef<(() => void) | null>(null);
  const [muted, setMuted] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ["my-store", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("*")
        .eq("seller_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["seller-products", store?.id],
    enabled: !!store,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, units(short_name)")
        .eq("store_id", store!.id)
        .order("product_name");
      return data ?? [];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ["seller-wallet", store?.id],
    enabled: !!store?.id,
    refetchInterval: 30000,
    queryFn: async () =>
      (
        await supabase
          .from("seller_wallets")
          .select("unsettled_balance,lifetime_earned")
          .eq("store_id", store!.id)
          .maybeSingle()
      ).data,
  });

  const { data: orderItems } = useQuery({
    queryKey: ["seller-orders", store?.id],
    enabled: !!store,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("order_id, product_name, qty, line_total, orders(*)")
        .eq("store_id", store!.id);
      return data ?? [];
    },
  });

  const grouped: Record<string, { order: SellerOrder; lines: SellerLine[] }> = {};
  for (const it of orderItems ?? []) {
    const o = it.orders as SellerOrder | null;
    if (!o) continue;
    const bucket = (grouped[o.id] ??= { order: o, lines: [] });
    bucket.lines.push(it as unknown as SellerLine);
  }
  const orders = Object.values(grouped).sort(
    (a, b) => new Date(b.order.placed_at).getTime() - new Date(a.order.placed_at).getTime(),
  );

  const newOrders = orders.filter((o) => o.order.status === "PLACED").length;

  // Loud repeating alert until every new order is accepted
  useEffect(() => {
    stopAlarm.current?.();
    stopAlarm.current = null;
    if (newOrders > 0 && !muted) stopAlarm.current = startOrderAlarm();
    return () => stopAlarm.current?.();
  }, [newOrders, muted]);

  // "Aaj ke liye khatam" auto-resets next day
  useEffect(() => {
    if (typeof window === "undefined" || !store) return;
    const raw = window.localStorage.getItem(OOS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as { day: string; ids: string[] };
    const today = new Date().toDateString();
    if (saved.day === today || !saved.ids.length) return;
    void supabase
      .from("products")
      .update({ is_available: true })
      .in("id", saved.ids)
      .then(() => {
        window.localStorage.removeItem(OOS_KEY);
        void qc.invalidateQueries({ queryKey: ["seller-products"] });
      });
  }, [store, qc]);

  async function markOutForToday(productId: string) {
    await supabase.from("products").update({ is_available: false }).eq("id", productId);
    const today = new Date().toDateString();
    const raw = window.localStorage.getItem(OOS_KEY);
    const saved = raw ? (JSON.parse(raw) as { day: string; ids: string[] }) : { day: today, ids: [] };
    const ids = saved.day === today ? [...new Set([...saved.ids, productId])] : [productId];
    window.localStorage.setItem(OOS_KEY, JSON.stringify({ day: today, ids }));
    toast.success("Aaj ke liye khatam — kal apne aap wapas aa jayega");
    void qc.invalidateQueries({ queryKey: ["seller-products"] });
  }

  async function takeBreak() {
    if (!store) return;
    await supabase.from("stores").update({ is_active: false }).eq("id", store.id);
    void qc.invalidateQueries({ queryKey: ["my-store"] });
    toast.success("30 minute ka break shuru — dukan apne aap khul jayegi");
    window.setTimeout(
      async () => {
        await supabase.from("stores").update({ is_active: true }).eq("id", store.id);
        void qc.invalidateQueries({ queryKey: ["my-store"] });
      },
      30 * 60 * 1000,
    );
  }

  async function askPayout() {
    if (!store) return;
    try {
      const res = await payout({ data: { storeId: store.id } });
      toast.success(`Payout request bhej di — ${inr(res.amount)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payout request fail ho gayi");
    }
  }

  async function toggleStore(active: boolean) {
    if (!store) return;
    await supabase.from("stores").update({ is_active: active }).eq("id", store.id);
    void qc.invalidateQueries({ queryKey: ["my-store"] });
    toast.success(active ? "Store is now open" : "Store closed");
  }

  async function advance(orderId: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as never })
      .eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["seller-orders"] });
    toast.success("Order updated");
  }

  if (!roles.includes("SELLER")) {
    return (
      <AppShell>
        <PageHeader title="Seller panel" />
        <p className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          You are not an approved seller yet. Apply from your account page.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={store?.store_name ?? "Seller panel"}
        subtitle={store?.address_line}
        right={
          store ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {store.is_active ? "Dukan Khuli Hai" : "Dukan Band Hai"}
              </span>
              <Switch checked={store.is_active} onCheckedChange={toggleStore} />
            </div>
          ) : undefined
        }
      />
      <main className="mx-auto max-w-3xl px-4 py-4">
        {isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin" />
        ) : !store ? (
          <p className="text-center text-sm text-muted-foreground">
            No store linked to your account yet.
          </p>
        ) : (
          <>
          <section className="mb-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Aaj ka unsettled payment</p>
                <p className="font-display text-2xl font-bold text-primary">
                  {inr(Number(wallet?.unsettled_balance ?? 0))}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Lifetime: {inr(Number(wallet?.lifetime_earned ?? 0))} · Har raat admin sidhe aapke
                  UPI/Bank me bhejta hai.
                </p>
              </div>
              <PayoutDetails
                table="stores"
                matchValue={store.id}
                current={store}
                onSaved={() => void qc.invalidateQueries({ queryKey: ["my-store"] })}
              />
            </div>
          </section>
          <Tabs defaultValue="orders">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => void takeBreak()}>
                  <Coffee className="size-4" /> 30 Minute ka Break
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => void askPayout()}>
                  <IndianRupee className="size-4" /> Paisa Nikalein
                </Button>
                {newOrders > 0 ? (
                  <Button size="sm" variant="secondary" className="gap-1" onClick={() => setMuted((m) => !m)}>
                    <BellRing className="size-4" /> {muted ? "Ringtone ON karein" : "Ringtone band karein"}
                  </Button>
                ) : null}
              </div>
              {orders.map(({ order, lines }) => {
                const next = NEXT[order.status as string];
                return (
                  <div key={order.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold">{order.order_no}</span>
                      <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm">
                      {lines.map((l, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {l.product_name} × {l.qty}
                          </span>
                          <span>{inr(l.line_total)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{order.delivery_address}</p>
                    {next ? (
                      <Button
                        className="mt-3 w-full"
                        onClick={() => advance(order.id, next.to)}
                      >
                        {next.label}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              {orders.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No orders yet.
                </p>
              ) : null}
            </TabsContent>

            <TabsContent value="products" className="mt-4 space-y-3">
              <ProductDialog
                storeId={store.id}
                onSaved={() => void qc.invalidateQueries({ queryKey: ["seller-products"] })}
              />
              {(products ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <Package className="size-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {inr(p.price)} · stock {p.stock_qty}
                    </p>
                  </div>
                  <Switch
                    checked={p.is_available}
                    onCheckedChange={async (v) => {
                      await supabase.from("products").update({ is_available: v }).eq("id", p.id);
                      void qc.invalidateQueries({ queryKey: ["seller-products"] });
                    }}
                  />
                  <VariantManager productId={p.id} productName={p.product_name} />
                  {p.is_available ? (
                    <Button size="sm" variant="ghost" onClick={() => void markOutForToday(p.id)}>
                      Aaj ke liye Khatam
                    </Button>
                  ) : null}
                </div>
              ))}
            </TabsContent>
          </Tabs>
          </>
        )}
      </main>
    </AppShell>
  );
}

function ProductDialog({ storeId, onSaved }: { storeId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("10");
  const [unitQty, setUnitQty] = useState("1");
  const [unitId, setUnitId] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id,short_name,name");
      return data ?? [];
    },
  });

  async function save() {
    if (!name.trim() || !price) { toast.error("Enter product name and price"); return; }
    setSaving(true);
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        store_id: storeId,
        product_name: name.trim(),
        price: Number(price),
        mrp: mrp ? Number(mrp) : null,
        stock_qty: Number(stock),
        unit_qty: Number(unitQty),
        unit_id: unitId || null,
      })
      .select("id")
      .single();
    if (error || !created) {
      setSaving(false);
      toast.error(error?.message ?? "Product save nahi hua");
      return;
    }
    const rows = draftsToRows(created.id, variants);
    if (rows.length) {
      const { error: vErr } = await supabase.from("product_variants").insert(rows);
      if (vErr) toast.error(`Sizes save nahi hue: ${vErr.message}`);
    }
    setSaving(false);
    toast.success(rows.length ? `Product + ${rows.length} size add ho gaye` : "Product added");
    setName("");
    setPrice("");
    setMrp("");
    setVariants([]);
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2">
          <Plus className="size-4" /> Add product
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New product</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Product name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input inputMode="decimal" value={mrp} onChange={(e) => setMrp(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pack qty</Label>
              <Input inputMode="decimal" value={unitQty} onChange={(e) => setUnitQty(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="kg / g / pc / litre" />
              </SelectTrigger>
              <SelectContent>
                {(units ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.short_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Add product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
