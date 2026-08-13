import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IndianRupee, Percent, Store, Bike, Activity, Banknote, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard, StatCard } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { inr, STATUS_LABEL } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Super Admin Dashboard — Mannu A2Z Mart" },
      { name: "description", content: "Live sales, commission revenue, active stores, delivery partners and running orders." },
      { property: "og:title", content: "Super Admin Dashboard — Mannu A2Z Mart" },
      { property: "og:description", content: "Real-time control centre for Mannu A2Z Mart operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const LIVE = ["PLACED", "ACCEPTED", "PREPARING", "READY", "ASSIGNED", "PICKED_UP", "ON_THE_WAY"];

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["admin-dashboard"],
    refetchInterval: 10000,
    queryFn: async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);

      const [ordersRes, storesRes, catsRes, partnersRes, liveRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id,total,subtotal,payment_mode,status,platform_fee,placed_at,order_no")
          .gte("placed_at", dayStart.toISOString())
          .order("placed_at", { ascending: false }),
        supabase.from("stores").select("id,is_active,store_status,commission_pct,category_id"),
        supabase.from("categories").select("id,commission_pct"),
        supabase.from("delivery_profiles").select("user_id,is_online,cash_in_hand"),
        supabase
          .from("orders")
          .select("id,order_no,status,total,placed_at")
          .in("status", LIVE as never[])
          .order("placed_at", { ascending: false })
          .limit(12),
      ]);

      const orders = ordersRes.data ?? [];
      const stores = storesRes.data ?? [];
      const cats = catsRes.data ?? [];
      const catPct = new Map(cats.map((c) => [c.id, Number(c.commission_pct)]));
      const storePct = new Map(
        stores.map((s) => [
          s.id,
          s.commission_pct != null
            ? Number(s.commission_pct)
            : (s.category_id ? catPct.get(s.category_id) : undefined) ?? 10,
        ]),
      );

      const ids = orders.map((o) => o.id);
      const itemsRes = ids.length
        ? await supabase.from("order_items").select("order_id,store_id,line_total").in("order_id", ids)
        : { data: [] };
      const commission = (itemsRes.data ?? []).reduce(
        (sum, i) => sum + Number(i.line_total) * ((storePct.get(i.store_id) ?? 10) / 100),
        0,
      );

      const paid = orders.filter((o) => o.status !== "CANCELLED");
      const sales = paid.reduce((s, o) => s + Number(o.total), 0);
      const cod = paid.filter((o) => o.payment_mode === "COD");
      const online = paid.filter((o) => o.payment_mode !== "COD");
      const platformFees = paid.reduce((s, o) => s + Number(o.platform_fee), 0);

      return {
        sales,
        orderCount: paid.length,
        commission: commission + platformFees,
        codAmount: cod.reduce((s, o) => s + Number(o.total), 0),
        codCount: cod.length,
        onlineAmount: online.reduce((s, o) => s + Number(o.total), 0),
        onlineCount: online.length,
        activeStores: stores.filter((s) => s.is_active && s.store_status === "OPEN").length,
        totalStores: stores.length,
        onlinePartners: (partnersRes.data ?? []).filter((p) => p.is_online).length,
        totalPartners: (partnersRes.data ?? []).length,
        cashInHand: (partnersRes.data ?? []).reduce((s, p) => s + Number(p.cash_in_hand), 0),
        live: liveRes.data ?? [],
      };
    },
  });

  return (
    <AdminLayout title="Dashboard Analytics" subtitle="Live platform performance · refreshes every 10s">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Today's sales" value={inr(data?.sales ?? 0)} hint={`${data?.orderCount ?? 0} orders`} icon={IndianRupee} />
        <StatCard label="Commission revenue" value={inr(data?.commission ?? 0)} hint="incl. platform fees" icon={Percent} />
        <StatCard label="Active stores" value={`${data?.activeStores ?? 0}`} hint={`of ${data?.totalStores ?? 0} registered`} icon={Store} />
        <StatCard label="Delivery boys online" value={`${data?.onlinePartners ?? 0}`} hint={`of ${data?.totalPartners ?? 0} partners`} icon={Bike} />
        <StatCard label="Live active orders" value={`${data?.live.length ?? 0}`} hint="in progress now" icon={Activity} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <StatCard label="Cash on delivery" value={inr(data?.codAmount ?? 0)} hint={`${data?.codCount ?? 0} orders today`} icon={Banknote} />
        <StatCard label="Online payments" value={inr(data?.onlineAmount ?? 0)} hint={`${data?.onlineCount ?? 0} orders today`} icon={CreditCard} />
        <StatCard label="Cash in hand (partners)" value={inr(data?.cashInHand ?? 0)} hint="pending settlement" icon={Banknote} />
      </div>

      <AdminCard className="mt-4">
        <h2 className="font-display text-base font-bold">Live orders</h2>
        <div className="mt-3 space-y-2">
          {(data?.live ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-semibold">{o.order_no}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(o.placed_at).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="text-right">
                <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                <p className="mt-1 text-sm font-bold text-primary">{inr(Number(o.total))}</p>
              </div>
            </div>
          ))}
          {!data?.live.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No live orders right now.</p>
          ) : null}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}