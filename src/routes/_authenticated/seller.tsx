import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
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

const NEXT: Record<string, { to: string; label: string }> = {
  PLACED: { to: "ACCEPTED", label: "Accept order" },
  ACCEPTED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready for pickup" },
};

function SellerPanel() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

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

  const orders = Object.values(
    (orderItems ?? []).reduce<Record<string, { order: Record<string, any>; lines: any[] }>>(
      (acc, it) => {
        const o = it.orders as Record<string, any> | null;
        if (!o) return acc;
        acc[o.id] ??= { order: o, lines: [] };
        acc[o.id].lines.push(it);
        return acc;
      },
      {},
    ),
  ).sort(
    (a, b) => new Date(b.order.placed_at).getTime() - new Date(a.order.placed_at).getTime(),
  );

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
    if (error) return toast.error(error.message);
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
                {store.is_active ? "Open" : "Closed"}
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
          <Tabs defaultValue="orders">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4 space-y-3">
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
                        onClick={() => advance(order.id as string, next.to)}
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
                </div>
              ))}
            </TabsContent>
          </Tabs>
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

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id,short_name,name");
      return data ?? [];
    },
  });

  async function save() {
    if (!name.trim() || !price) return toast.error("Enter product name and price");
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      product_name: name.trim(),
      price: Number(price),
      mrp: mrp ? Number(mrp) : null,
      stock_qty: Number(stock),
      unit_qty: Number(unitQty),
      unit_id: unitId || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product added");
    setName("");
    setPrice("");
    setMrp("");
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
