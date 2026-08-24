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
import { placeOrder, payOrderFromWallet, quoteOrder } from "@/lib/mannu.functions";
import { useBusiness, upiIntent } from "@/hooks/useBusiness";
import { playSuccessChime } from "@/lib/sound";

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
  const payWallet = useServerFn(payOrderFromWallet);
  const { business, brand } = useBusiness();
  const [addressId, setAddressId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [placing, setPlacing] = useState(false);
  const [mode, setMode] = useState<"COD" | "ONLINE" | "WALLET">("COD");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

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
    if (!addressId && addresses?.[0]) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });
  const walletBalance = Number(wallet?.balance ?? 0);

  const cartKey = cart.items.map((i) => `${i.productId}:${i.qty}`).join(",");
  const { data: quote, error: quoteError } = useQuery({
    queryKey: ["order-quote", addressId, cartKey, coupon.trim().toUpperCase()],
    enabled: !!addressId && cart.items.length > 0,
    retry: false,
    queryFn: () =>
      getQuote({
        data: {
          addressId: addressId!,
          couponCode: coupon.trim() ? coupon.trim() : undefined,
          items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        },
      }),
  });
  const payable = quote?.total ?? cart.subtotal;
  const upiId = business?.upi_id?.trim() || "764384019@ybl";
  const upiLink = upiIntent({
    upiId,
    name: brand,
    amount: payable,
    note: "Mannu order",
  });


  async function handlePlace() {
    if (!addressId) { toast.error("Add a delivery address first"); return; }
    if (!cart.items.length) { toast.error("Your cart is empty"); return; }
    if (recipientPhone && !/^[6-9]\d{9}$/.test(recipientPhone)) {
      toast.error("Receiver ka sahi 10-digit phone number daalein");
      return;
    }
    setPlacing(true);
    try {
      const order = await submit({
        data: {
          addressId,
          paymentMode: mode,
          couponCode: coupon.trim() ? coupon.trim() : undefined,
          recipientName: recipientName.trim() || undefined,
          recipientPhone: recipientPhone.trim() || undefined,
          items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        },
      });
      if (mode === "WALLET") await payWallet({ data: { orderId: order.id } });
      cart.clear();
      playSuccessChime();
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
          <h2 className="font-display font-bold">Bill Summary</h2>
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
              <span>{inr(quote?.subtotal ?? cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery fee</span>
              <span>
                {quote ? (
                  quote.deliveryCharge === 0 ? (
                    <span className="font-semibold text-primary">FREE</span>
                  ) : (
                    inr(quote.deliveryCharge)
                  )
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform fee</span>
              <span>{quote ? inr(quote.platformFee) : "—"}</span>
            </div>
            {quote && quote.discount > 0 ? (
              <div className="flex justify-between text-sm text-primary">
                <span>Coupon {quote.couponCode ?? ""}</span>
                <span>-{inr(quote.discount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-dashed border-border pt-2 text-base font-bold">
              <span>To pay</span>
              <span>{inr(payable)}</span>
            </div>
            {quoteError ? (
              <p className="text-xs text-destructive">{quoteError.message}</p>
            ) : quote ? (
              <p className="text-[11px] text-muted-foreground">
                Distance {quote.distanceKm} km{quote.isMulti ? " · multi-store pickup" : ""}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Calculating charges…</p>
            )}
          </div>
        </section>


        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">Delivery contact details</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Rider isi number par call karega — kisi aur ke liye order kar rahe hain to unka naam
            aur number dein.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rname">Receiver name</Label>
              <Input
                id="rname"
                className="mt-1.5"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Jaise: Suraj Kumar"
              />
            </div>
            <div>
              <Label htmlFor="rphone">Receiver phone</Label>
              <Input
                id="rphone"
                className="mt-1.5"
                inputMode="numeric"
                maxLength={10}
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit mobile"
              />
            </div>
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
          <div className="mt-3 grid gap-2">
            {([
              { key: "COD", label: "Cash on Delivery", hint: "Rider ko delivery par cash dein" },
              { key: "WALLET", label: `Mera Wallet · ${inr(walletBalance)}`, hint: "Instant wallet se payment" },
              { key: "ONLINE", label: "Pay Online (UPI / QR)", hint: business?.upi_id ?? "UPI" },
            ] as const).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                disabled={m.key === "WALLET" && walletBalance < cart.subtotal}
                className={`w-full rounded-xl border p-3 text-left disabled:opacity-50 ${
                  mode === m.key ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <p className="text-sm font-semibold">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.hint}</p>
              </button>
            ))}
          </div>
          {mode === "ONLINE" ? (
            <div className="mt-3 rounded-xl border border-border p-3 text-center">
              {business?.qr_image_url ? (
                <img
                  src={business.qr_image_url}
                  alt={`${brand} payment QR code`}
                  className="mx-auto size-40 rounded-lg object-contain"
                  loading="lazy"
                />
              ) : null}
              {business?.upi_id ? (
                <>
                  <p className="mt-2 text-sm font-semibold">{business.upi_id}</p>
                  <a
                    className="mt-2 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                    href={upiIntent({
                      upiId: business.upi_id,
                      name: brand,
                      amount: cart.subtotal,
                      note: "Mannu order",
                    })}
                  >
                    Pay with UPI app
                  </a>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Online payment details abhi set nahi hain — COD chunein.
                </p>
              )}
            </div>
          ) : null}
        </section>

        <Button className="h-12 w-full text-base" onClick={handlePlace} disabled={placing}>
          {placing ? <Loader2 className="size-4 animate-spin" /> : `Place order (${mode})`}
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
