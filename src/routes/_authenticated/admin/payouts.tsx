import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr } from "@/lib/mannu";
import { upiIntent } from "@/hooks/useBusiness";
import { markSettled } from "@/lib/mannu.functions";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts & Commission — Mannu Admin" },
      { name: "description", content: "Track store earnings, platform commission and settle pending payouts with transaction IDs." },
      { property: "og:title", content: "Payouts & Commission — Mannu Admin" },
      { property: "og:description", content: "Store payout manager for Mannu A2Z Mart." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Payouts,
});

type Payee = {
  key: string;
  type: "SELLER" | "RIDER";
  id: string;
  name: string;
  phone: string;
  amount: number;
  todayCount: number;
  upi: string | null;
  qr: string | null;
  bank: { account_holder?: string; bank_name?: string; account_number?: string; ifsc?: string };
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Payouts() {
  const qc = useQueryClient();
  const settle = useServerFn(markSettled);
  const [ref, setRef] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["night-settlement"],
    refetchInterval: 30000,
    queryFn: async () => {
      const since = startOfToday();
      const [sw, de, storesRes, profilesRes, dpRes, todayOrders, todayItems] = await Promise.all([
        supabase.from("seller_wallets").select("*").gt("unsettled_balance", 0),
        supabase.from("driver_earnings").select("*").gt("unsettled_balance", 0),
        supabase.from("stores").select("id,store_name,seller_id,payout_upi_id,payout_qr_url,bank_details"),
        supabase.from("profiles").select("id,full_name,phone"),
        supabase.from("delivery_profiles").select("user_id,payout_upi_id,payout_qr_url,bank_details"),
        supabase
          .from("orders")
          .select("id,total,payment_mode,delivery_boy_id,platform_fee,delivery_charge,status,delivered_at")
          .eq("status", "DELIVERED")
          .gte("delivered_at", since),
        supabase
          .from("order_items")
          .select("store_id,line_total,orders!inner(status,delivered_at)")
          .eq("orders.status", "DELIVERED")
          .gte("orders.delivered_at", since),
      ]);

      const profiles = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const dpMap = new Map((dpRes.data ?? []).map((d) => [d.user_id, d]));
      const orders = todayOrders.data ?? [];
      const items = todayItems.data ?? [];

      const sellers: Payee[] = (sw.data ?? []).map((w) => {
        const store = (storesRes.data ?? []).find((s) => s.id === w.store_id);
        const seller = store?.seller_id ? profiles.get(store.seller_id) : undefined;
        return {
          key: `S-${w.store_id}`,
          type: "SELLER",
          id: w.store_id,
          name: store?.store_name ?? "Store",
          phone: seller?.phone ?? "",
          amount: Number(w.unsettled_balance),
          todayCount: items.filter((i) => i.store_id === w.store_id).length,
          upi: store?.payout_upi_id ?? null,
          qr: store?.payout_qr_url ?? null,
          bank: (store?.bank_details as Payee["bank"]) ?? {},
        };
      });

      const riders: Payee[] = (de.data ?? []).map((d) => {
        const p = profiles.get(d.user_id);
        const dp = dpMap.get(d.user_id);
        return {
          key: `R-${d.user_id}`,
          type: "RIDER",
          id: d.user_id,
          name: p?.full_name || p?.phone || "Delivery partner",
          phone: p?.phone ?? "",
          amount: Number(d.unsettled_balance),
          todayCount: orders.filter((o) => o.delivery_boy_id === d.user_id).length,
          upi: dp?.payout_upi_id ?? null,
          qr: dp?.payout_qr_url ?? null,
          bank: (dp?.bank_details as Payee["bank"]) ?? {},
        };
      });

      const onlineCollection = orders
        .filter((o) => o.payment_mode !== "COD")
        .reduce((s, o) => s + Number(o.total), 0);
      const payableSellers = sellers.reduce((s, x) => s + x.amount, 0);
      const payableRiders = riders.reduce((s, x) => s + x.amount, 0);
      const grossToday = orders.reduce((s, o) => s + Number(o.total), 0);

      return {
        list: [...sellers, ...riders].sort((a, b) => b.amount - a.amount),
        kpi: {
          onlineCollection,
          payableSellers,
          payableRiders,
          profit: grossToday - payableSellers - payableRiders,
        },
      };
    },
  });

  const { data: history } = useQuery({
    queryKey: ["settlement-history"],
    queryFn: async () =>
      (
        await supabase
          .from("settlement_history")
          .select("*")
          .order("settled_at", { ascending: false })
          .limit(10)
      ).data ?? [],
  });

  async function done(p: Payee) {
    setBusy(p.key);
    try {
      await settle({
        data: {
          payeeType: p.type,
          payeeId: p.id,
          payeeName: p.name,
          amount: +p.amount.toFixed(2),
          ordersCount: p.todayCount,
          reference: ref[p.key]?.trim() || undefined,
          method: p.upi ? "UPI" : "BANK",
        },
      });
      toast.success(`${p.name} settled — ${inr(p.amount)}`);
      void qc.invalidateQueries({ queryKey: ["night-settlement"] });
      void qc.invalidateQueries({ queryKey: ["settlement-history"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Settle nahi ho paya");
    } finally {
      setBusy(null);
    }
  }

  const kpi = data?.kpi;
  const list = data?.list ?? [];

  return (
    <AdminLayout title="Night Settlement Master" subtitle="Aaj raat ka ek-screen payout control">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today's online collections" value={inr(kpi?.onlineCollection ?? 0)} />
        <Kpi label="Total payable to sellers" value={inr(kpi?.payableSellers ?? 0)} />
        <Kpi label="Total payable to riders" value={inr(kpi?.payableRiders ?? 0)} />
        <Kpi label="Today's net admin profit" value={inr(kpi?.profit ?? 0)} accent />
      </div>

      {list.length === 0 ? (
        <AdminCard>
          <p className="py-10 text-center font-display text-lg font-bold">
            Shaandar! Aaj ka sabhi payout complete ho gaya hai. 🎉
          </p>
        </AdminCard>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((p) => (
            <AdminCard key={p.key}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.phone || "No phone"}</p>
                </div>
                <Badge variant={p.type === "SELLER" ? "secondary" : "default"}>
                  {p.type === "SELLER" ? "Dukandar" : "Delivery Boy"}
                </Badge>
              </div>

              <div className="mt-2 flex items-end justify-between">
                <span className="text-xs text-muted-foreground">
                  Aaj {p.todayCount} {p.type === "SELLER" ? "orders" : "deliveries"}
                </span>
                <span className="font-display text-2xl font-bold text-primary">
                  {inr(p.amount)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.upi ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        void navigator.clipboard.writeText(p.upi!);
                        toast.success("UPI ID copy ho gaya");
                      }}
                    >
                      <Copy className="size-3.5" /> {p.upi}
                    </Button>
                    <a
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      href={upiIntent({
                        upiId: p.upi,
                        name: p.name,
                        amount: p.amount,
                        note: "Mannu payout",
                      })}
                    >
                      Pay now
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    UPI nahi hai —{" "}
                    {p.bank.account_number
                      ? `${p.bank.bank_name ?? "Bank"} ${p.bank.account_number} / ${p.bank.ifsc ?? ""}`
                      : "bank details bhi missing"}
                  </span>
                )}
                {p.qr ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1">
                        <QrCode className="size-3.5" /> QR
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{p.name} · QR</DialogTitle>
                      </DialogHeader>
                      <img src={p.qr} alt={`${p.name} payout QR`} className="mx-auto w-64" />
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  className="w-40"
                  placeholder="UTR / reference"
                  value={ref[p.key] ?? ""}
                  onChange={(e) => setRef((r) => ({ ...r, [p.key]: e.target.value }))}
                />
                <Button size="sm" className="gap-1" disabled={busy === p.key} onClick={() => void done(p)}>
                  <Check className="size-4" /> Mark settled
                </Button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      <AdminCard className="mt-4">
        <p className="font-semibold">Recent settlements</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {(history ?? []).map((h) => (
            <p key={h.id}>
              {new Date(h.settled_at).toLocaleString("en-IN")} · {h.payee_name} ·{" "}
              {h.payee_type === "SELLER" ? "Dukandar" : "Delivery Boy"} · {inr(Number(h.amount))} ·{" "}
              {h.reference ?? "no ref"}
            </p>
          ))}
          {history?.length === 0 ? <p>Abhi tak koi settlement nahi hui.</p> : null}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <AdminCard>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? "text-primary" : ""}`}>
        {value}
      </p>
    </AdminCard>
  );
}