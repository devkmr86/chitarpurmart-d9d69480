import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LocateFixed, MapPin, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Map } from "@/components/app/Map";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { inr, RANCHI_CENTER } from "@/lib/mannu";
import { placeOrder } from "@/lib/mannu.functions";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Mannu A2Z Mart" },
      { name: "description", content: "Choose your delivery address and place your Mannu A2Z Mart order." },
      { property: "og:title", content: "Checkout — Mannu A2Z Mart" },
      { property: "og:description", content: "Confirm address, apply coupon and pay on delivery." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useServerFn(placeOrder);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [placing, setPlacing] = useState(false);

  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_addresses")
        .select("*")
        .order("is_default", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!addressId && addresses?.length) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  async function handlePlace() {
    if (!addressId) { toast.error("Add a delivery address first"); return; }
    if (!cart.items.length) { toast.error("Your cart is empty"); return; }
    setPlacing(true);
    try {
      const order = await submit({
        data: {
          addressId,
          paymentMode: "COD",
          couponCode: coupon.trim() ? coupon.trim() : undefined,
          items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        },
      });
      cart.clear();
      toast.success(`Order ${order.order_no} placed!`);
      navigate({ to: "/order/$orderId", params: { orderId: order.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Checkout" subtitle={cart.storeName ?? undefined} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">Delivery address</h2>
            <AddressDialog
              onSaved={(id) => {
                setAddressId(id);
                void qc.invalidateQueries({ queryKey: ["addresses"] });
              }}
            />
          </div>
          <div className="mt-3 space-y-2">
            {(addresses ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => setAddressId(a.id)}
                className={`flex w-full gap-3 rounded-xl border p-3 text-left ${
                  addressId === a.id ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.address_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {[a.house_flat_no, a.street_area, a.landmark].filter(Boolean).join(", ")}
                  </p>
                </div>
              </button>
            ))}
            {addresses?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No address saved yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">Order summary</h2>
          <div className="mt-3 space-y-1.5">
            {cart.items.map((i) => (
              <div key={i.productId} className="flex justify-between text-sm">
                <span className="truncate pr-3 text-muted-foreground">
                  {i.name} × {i.qty}
                </span>
                <span>{inr(i.price * i.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Item total</span>
              <span>{inr(cart.subtotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Delivery charge, platform fee and any discount are calculated securely when the
              order is placed.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <Label htmlFor="coupon">Coupon code</Label>
          <Input
            id="coupon"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="MANNU50"
            className="mt-2"
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">Payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cash on Delivery — pay the delivery partner when your order arrives.
          </p>
        </section>

        <Button className="h-12 w-full text-base" onClick={handlePlace} disabled={placing}>
          {placing ? <Loader2 className="size-4 animate-spin" /> : "Place order (COD)"}
        </Button>
      </main>
    </AppShell>
  );
}

function AddressDialog({ onSaved }: { onSaved: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState(RANCHI_CENTER);
  const [type, setType] = useState("Home");
  const [house, setHouse] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");

  function locate() {
    if (!navigator.geolocation) { toast.error("Location not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Could not fetch your location"),
    );
  }

  async function save() {
    if (!house.trim() || !street.trim()) { toast.error("Fill house and area"); return; }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: auth.user!.id,
        address_type: type,
        house_flat_no: house.trim(),
        street_area: street.trim(),
        landmark: landmark.trim() || null,
        latitude: pos.lat,
        longitude: pos.lng,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Could not save address"); return; }
    toast.success("Address saved");
    setOpen(false);
    onSaved(data.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Plus className="size-4" /> Add
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New delivery address</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border">
            <Map
              center={pos}
              zoom={15}
              className="h-48 w-full"
              onMapClick={(lat, lng) => setPos({ lat, lng })}
              markers={[
                {
                  lat: pos.lat,
                  lng: pos.lng,
                  kind: "home",
                  draggable: true,
                  onDragEnd: (lat, lng) => setPos({ lat, lng }),
                },
              ]}
            />
          </div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={locate}>
            <LocateFixed className="size-4" /> Use my current location
          </Button>
          <div className="grid grid-cols-3 gap-2">
            {["Home", "Work", "Other"].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-xl border py-2 text-sm font-medium ${
                  type === t ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input value={house} onChange={(e) => setHouse(e.target.value)} placeholder="House / flat no." />
          <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street / area" />
          <Input value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Landmark (optional)" />
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save address"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
