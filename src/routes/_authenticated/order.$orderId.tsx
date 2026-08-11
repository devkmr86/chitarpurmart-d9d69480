import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Map } from "@/components/app/Map";
import type { MapMarker } from "@/components/app/MapView";
import { inr, ORDER_FLOW, STATUS_LABEL, RANCHI_CENTER } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/order/$orderId")({
  head: () => ({
    meta: [
      { title: "Track order — Mannu A2Z Mart" },
      { name: "description", content: "Live map tracking and status updates for your order." },
      { property: "og:title", content: "Track order — Mannu A2Z Mart" },
      { property: "og:description", content: "Follow your delivery partner in real time." },
    ],
  }),
  component: OrderTracking,
});

function OrderTracking() {
  const { orderId } = Route.useParams();
  const qc = useQueryClient();
  const [rider, setRider] = useState<{ lat: number; lng: number } | null>(null);

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => void qc.invalidateQueries({ queryKey: ["order", orderId] }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_location_logs",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const row = payload.new as { latitude: number; longitude: number };
          setRider({ lat: Number(row.latitude), lng: Number(row.longitude) });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, qc]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("delivery_location_logs")
        .select("latitude,longitude")
        .eq("order_id", orderId)
        .order("recorded_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (row && !cancelled) setRider({ lat: Number(row.latitude), lng: Number(row.longitude) });
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const { data: partner } = useQuery({
    queryKey: ["order-partner", order?.delivery_boy_id],
    enabled: !!order?.delivery_boy_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,phone")
        .eq("id", order!.delivery_boy_id!)
        .maybeSingle();
      return data;
    },
  });

  const dest =
    order?.delivery_lat && order?.delivery_lng
      ? { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) }
      : RANCHI_CENTER;

  const markers: MapMarker[] = [{ ...dest, kind: "home", label: "Delivery address" }];
  if (rider) markers.push({ ...rider, kind: "rider", label: "Delivery partner" });

  const currentIdx = ORDER_FLOW.indexOf(
    (order?.status ?? "PLACED") as (typeof ORDER_FLOW)[number],
  );

  return (
    <AppShell>
      <PageHeader
        title={order?.order_no ?? "Order"}
        subtitle={order ? STATUS_LABEL[order.status] : undefined}
      />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <div className="overflow-hidden rounded-2xl border border-border">
          <Map
            center={rider ?? dest}
            zoom={14}
            className="h-56 w-full"
            markers={markers}
            path={rider ? [[rider.lat, rider.lng], [dest.lat, dest.lng]] : undefined}
          />
        </div>

        {order?.status !== "DELIVERED" && order?.status !== "CANCELLED" ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground">Share this OTP on delivery</p>
            <p className="font-display text-3xl font-extrabold tracking-[0.4em] text-primary">
              {order?.otp}
            </p>
          </div>
        ) : null}

        {partner?.full_name ? (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div>
              <p className="text-xs text-muted-foreground">Delivery partner</p>
              <p className="font-semibold">{partner.full_name}</p>
            </div>
            {partner.phone ? (
              <a
                href={`tel:${partner.phone}`}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
                Call
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">Status</h2>
          <ol className="mt-3 space-y-3">
            {ORDER_FLOW.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`grid size-6 place-items-center rounded-full ${
                      done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : <Circle className="size-2" />}
                  </span>
                  <span className={done ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
                    {STATUS_LABEL[s]}
                  </span>
                </li>
              );
            })}
          </ol>
          {order?.status === "CANCELLED" ? (
            <Badge variant="destructive" className="mt-3">
              Order cancelled
            </Badge>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">Bill</h2>
          <div className="mt-3 space-y-1.5 text-sm">
            {(order?.order_items ?? []).map(
              (it: { id: string; product_name: string; qty: number; line_total: number }) => (
                <div key={it.id} className="flex justify-between">
                  <span className="truncate pr-3 text-muted-foreground">
                    {it.product_name} × {it.qty}
                  </span>
                  <span>{inr(it.line_total)}</span>
                </div>
              ),
            )}
            <Row label="Item total" value={order?.subtotal ?? 0} />
            <Row label="Delivery charge" value={order?.delivery_charge ?? 0} />
            <Row label="Platform fee" value={order?.platform_fee ?? 0} />
            {order?.discount ? <Row label="Discount" value={-order.discount} /> : null}
            <div className="flex justify-between border-t border-border pt-2 font-display font-bold">
              <span>Total ({order?.payment_mode})</span>
              <span className="text-primary">{inr(order?.total ?? 0)}</span>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{inr(value)}</span>
    </div>
  );
}
