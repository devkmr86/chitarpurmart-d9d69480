import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bike, IndianRupee, Loader2, Wallet, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { PayoutDetails } from "@/components/app/PayoutDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { inr, STATUS_LABEL } from "@/lib/mannu";
import { completeDelivery } from "@/lib/mannu.functions";
import { useBusiness, upiIntent } from "@/hooks/useBusiness";
import { playRadarPing, playSuccessChime } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery panel — Mannu A2Z Mart" },
      { name: "description", content: "Accept nearby orders, share live location and track your earnings." },
      { property: "og:title", content: "Delivery panel — Mannu A2Z Mart" },
      { property: "og:description", content: "Deliver with Mannu A2Z Mart in Ranchi." },
    ],
  }),
  component: DeliveryPanel,
});

function DeliveryPanel() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const complete = useServerFn(completeDelivery);
  const [otp, setOtp] = useState<Record<string, string>>({});
  const watchRef = useRef<number | null>(null);
  const lastCount = useRef(0);

  const { data: dp } = useQuery({
    queryKey: ["delivery-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: available } = useQuery({
    queryKey: ["available-orders"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .is("delivery_boy_id", null)
        .in("status", ["READY", "PREPARING"])
        .order("placed_at");
      return data ?? [];
    },
  });

  const { data: earn } = useQuery({
    queryKey: ["driver-earnings", user?.id],
    enabled: !!user,
    refetchInterval: 30000,
    queryFn: async () =>
      (
        await supabase
          .from("driver_earnings")
          .select("unsettled_balance,lifetime_earned")
          .eq("user_id", user!.id)
          .maybeSingle()
      ).data,
  });

  const { data: mine } = useQuery({
    queryKey: ["my-deliveries", user?.id],
    enabled: !!user,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("delivery_boy_id", user!.id)
        .order("placed_at", { ascending: false });
      return data ?? [];
    },
  });

  const activeIds = (mine ?? [])
    .filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED")
    .map((o) => o.id);

  // Radar chime when a new task appears
  const availableCount = available?.length ?? 0;
  useEffect(() => {
    if (availableCount > lastCount.current) playRadarPing();
    lastCount.current = availableCount;
  }, [availableCount]);

  // Share live GPS while online and carrying orders
  const online = dp?.is_online ?? false;
  useEffect(() => {
    if (!online || !user || activeIds.length === 0) return;
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      async (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        await supabase
          .from("delivery_profiles")
          .update({ current_lat: lat, current_lng: lng, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        await supabase.from("delivery_location_logs").insert(
          activeIds.map((orderId) => ({
            delivery_boy_id: user.id,
            order_id: orderId,
            latitude: lat,
            longitude: lng,
            speed: p.coords.speed ?? null,
            heading: p.coords.heading ?? null,
          })),
        );
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    watchRef.current = id;
    return () => navigator.geolocation.clearWatch(id);
  }, [online, user, activeIds.join(",")]);

  async function setOnline(v: boolean) {
    if (!user) return;
    await supabase
      .from("delivery_profiles")
      .upsert({ user_id: user.id, is_online: v }, { onConflict: "user_id" });
    void qc.invalidateQueries({ queryKey: ["delivery-profile"] });
  }

  async function accept(orderId: string) {
    if (!user) return;
    const { error } = await supabase
      .from("orders")
      .update({ delivery_boy_id: user.id, status: "ASSIGNED" })
      .eq("id", orderId)
      .is("delivery_boy_id", null);
    if (error) { toast.error(error.message); return; }
    toast.success("Order assigned to you");
    void qc.invalidateQueries({ queryKey: ["available-orders"] });
    void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
  }

  async function setStatus(orderId: string, status: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: status as never })
      .eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
  }

  async function finish(orderId: string) {
    const code = (otp[orderId] ?? "").trim();
    if (code.length !== 4) { toast.error("Enter the 4-digit OTP from the customer"); return; }
    try {
      await complete({ data: { orderId, otp: code } });
      playSuccessChime();
      toast.success("Delivered! Earnings credited.");
      void qc.invalidateQueries({ queryKey: ["my-deliveries"] });
      void qc.invalidateQueries({ queryKey: ["delivery-profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete delivery");
    }
  }

  if (!roles.includes("DELIVERY")) {
    return (
      <AppShell>
        <PageHeader title="Delivery panel" />
        <p className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          You are not an approved delivery partner yet. Apply from your account page.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Delivery panel"
        subtitle={online ? "You are online" : "You are offline"}
        right={<Switch checked={online} onCheckedChange={setOnline} />}
      />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={IndianRupee} label="Total earnings" value={inr(dp?.total_earnings ?? 0)} />
          <Stat icon={Wallet} label="Cash in hand" value={inr(dp?.cash_in_hand ?? 0)} />
        </div>

        <CashSettlement cash={Number(dp?.cash_in_hand ?? 0)} userId={user?.id} />

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Aaj ki unsettled earning</p>
              <p className="font-display text-2xl font-bold text-primary">
                {inr(Number(earn?.unsettled_balance ?? 0))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lifetime: {inr(Number(earn?.lifetime_earned ?? 0))} · Raat ko admin aapke UPI par
                bhej dega.
              </p>
            </div>
            {user ? (
              <PayoutDetails
                table="delivery_profiles"
                matchValue={user.id}
                current={dp}
                onSaved={() => void qc.invalidateQueries({ queryKey: ["delivery-profile"] })}
              />
            ) : null}
          </div>
        </section>

        <Tabs defaultValue="available">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="available">Available</TabsTrigger>
            <TabsTrigger value="mine">My deliveries</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="mt-4 space-y-3">
            {(available ?? []).map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">{o.order_no}</span>
                  <Badge variant="secondary">Earn {inr(o.delivery_earning)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{o.delivery_address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.distance_km} km {o.is_multi_pickup ? "· multi-pickup" : ""}
                </p>
                <Button className="mt-3 w-full" onClick={() => accept(o.id)} disabled={!online}>
                  {online ? "Accept order" : "Go online to accept"}
                </Button>
              </div>
            ))}
            {available?.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No orders waiting right now.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-3">
            {(mine ?? []).map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">{o.order_no}</span>
                  <Badge>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{o.delivery_address}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {o.status === "ASSIGNED" ? (

                    <Button size="sm" onClick={() => setStatus(o.id, "PICKED_UP")}>
                      Picked up
                    </Button>
                  ) : null}
                  {o.status === "PICKED_UP" ? (
                    <Button size="sm" onClick={() => setStatus(o.id, "ON_THE_WAY")}>
                      On the way
                    </Button>
                  ) : null}
                  {o.status === "ON_THE_WAY" ? (
                    <div className="flex w-full gap-2">
                      <Input
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="OTP"
                        value={otp[o.id] ?? ""}
                        onChange={(e) =>
                          setOtp((s) => ({ ...s, [o.id]: e.target.value.replace(/\D/g, "") }))
                        }
                      />
                      <Button onClick={() => finish(o.id)}>Complete</Button>
                    </div>
                  ) : null}
                  {o.status === "DELIVERED" ? (
                    <span className="text-xs text-muted-foreground">
                      Delivered · earned {inr(o.delivery_earning)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
            {mine?.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Bike className="mx-auto mb-2 size-6" />
                No deliveries yet.
              </p>
            ) : null}
          </TabsContent>
        </Tabs>
      </main>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="size-4 text-primary" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-bold">{value}</p>
    </div>
  );
}

/** Floating COD cash tracker with UPI intent + admin QR fallback. */
function CashSettlement({ cash, userId }: { cash: number; userId: string | undefined }) {
  const qc = useQueryClient();
  const { business, brand } = useBusiness();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!userId || !amt || amt <= 0) {
      toast.error("Sahi amount daalein");
      return;
    }
    if (!utr.trim()) {
      toast.error("UTR / transaction ID daalein");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("delivery_cash_settlements").insert({
      delivery_boy_id: userId,
      amount: amt,
      transaction_id: utr.trim(),
      note: "Rider self settlement",
    });
    if (!error) {
      const { data: dp } = await supabase
        .from("delivery_profiles")
        .select("cash_in_hand")
        .eq("user_id", userId)
        .maybeSingle();
      await supabase
        .from("delivery_profiles")
        .update({ cash_in_hand: Math.max(0, Number(dp?.cash_in_hand ?? 0) - amt) })
        .eq("user_id", userId);
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Cash jama record ho gaya");
    setOpen(false);
    setAmount("");
    setUtr("");
    void qc.invalidateQueries({ queryKey: ["delivery-profile"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2">
          <span className="flex items-center gap-2">
            <Wallet className="size-4" /> Company ko Cash Jama Karein
          </span>
          <span className="font-display font-bold">{inr(cash)}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cash Jama Karein</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Amount</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(cash)}
            />
          </div>
          {business?.upi_id ? (
            <a
              className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
              href={upiIntent({
                upiId: business.upi_id,
                name: brand,
                amount: Number(amount) || cash,
                note: "COD settlement",
              })}
            >
              UPI app se pay karein
            </a>
          ) : null}
          {business?.qr_image_url ? (
            <div className="rounded-xl border border-border p-3 text-center">
              <p className="mb-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <QrCode className="size-3.5" /> Admin QR scan karein
              </p>
              <img
                src={business.qr_image_url}
                alt={`${brand} settlement QR`}
                className="mx-auto size-44 rounded-lg object-contain"
                loading="lazy"
              />
            </div>
          ) : null}
          <div>
            <Label className="text-xs">UTR / Transaction ID</Label>
            <Input value={utr} onChange={(e) => setUtr(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Submit karein"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
