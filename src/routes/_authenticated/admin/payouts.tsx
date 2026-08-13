import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/mannu";

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

function Payouts() {
  const qc = useQueryClient();
  const [txn, setTxn] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async () => {
      const [storesRes, catsRes, itemsRes, payoutsRes] = await Promise.all([
        supabase.from("stores").select("id,store_name,commission_pct,category_id"),
        supabase.from("categories").select("id,commission_pct"),
        supabase.from("order_items").select("store_id,line_total,orders!inner(status)").eq("orders.status", "DELIVERED"),
        supabase.from("store_payouts").select("*").order("created_at", { ascending: false }),
      ]);
      const cats = new Map((catsRes.data ?? []).map((c) => [c.id, Number(c.commission_pct)]));
      const payouts = payoutsRes.data ?? [];
      return (storesRes.data ?? []).map((s) => {
        const pct = s.commission_pct != null ? Number(s.commission_pct) : (s.category_id ? cats.get(s.category_id) : undefined) ?? 10;
        const gross = (itemsRes.data ?? [])
          .filter((i) => i.store_id === s.id)
          .reduce((sum, i) => sum + Number(i.line_total), 0);
        const commission = (gross * pct) / 100;
        const paid = payouts
          .filter((p) => p.store_id === s.id && p.status === "PAID")
          .reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: s.id,
          name: s.store_name,
          pct,
          gross,
          commission,
          net: gross - commission,
          paid,
          pending: gross - commission - paid,
          history: payouts.filter((p) => p.store_id === s.id).slice(0, 3),
        };
      });
    },
  });

  async function markPaid(storeId: string, amount: number, commission: number) {
    if (amount <= 0) {
      toast.error("Nothing pending for this store");
      return;
    }
    const { error } = await supabase.from("store_payouts").insert({
      store_id: storeId,
      amount,
      commission_amount: commission,
      status: "PAID",
      transaction_id: txn[storeId] ?? null,
      paid_at: new Date().toISOString(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payout recorded");
    setTxn((t) => ({ ...t, [storeId]: "" }));
    void qc.invalidateQueries({ queryKey: ["admin-payouts"] });
  }

  const totals = (data ?? []).reduce(
    (acc, s) => ({
      commission: acc.commission + s.commission,
      pending: acc.pending + Math.max(0, s.pending),
    }),
    { commission: 0, pending: 0 },
  );

  return (
    <AdminLayout title="Payouts & Commission" subtitle="Store earnings and settlement">
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <AdminCard>
          <p className="text-xs text-muted-foreground">Total commission earned</p>
          <p className="mt-1 font-display text-2xl font-bold">{inr(totals.commission)}</p>
        </AdminCard>
        <AdminCard>
          <p className="text-xs text-muted-foreground">Pending store payouts</p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">{inr(totals.pending)}</p>
        </AdminCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {(data ?? []).map((s) => (
          <AdminCard key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <p className="truncate font-semibold">{s.name}</p>
              <Badge variant="secondary">{s.pct}% commission</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Delivered sales: <b className="text-foreground">{inr(s.gross)}</b></span>
              <span>Commission: <b className="text-foreground">{inr(s.commission)}</b></span>
              <span>Already paid: <b className="text-foreground">{inr(s.paid)}</b></span>
              <span>Pending: <b className="text-primary">{inr(Math.max(0, s.pending))}</b></span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="Transaction ID"
                value={txn[s.id] ?? ""}
                onChange={(e) => setTxn((t) => ({ ...t, [s.id]: e.target.value }))}
              />
              <Button size="sm" onClick={() => void markPaid(s.id, Math.max(0, +s.pending.toFixed(2)), +s.commission.toFixed(2))}>
                Mark paid
              </Button>
            </div>
            {s.history.length ? (
              <div className="mt-3 space-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
                {s.history.map((h) => (
                  <p key={h.id}>
                    {inr(Number(h.amount))} · {h.status} · {h.transaction_id ?? "no txn"} ·{" "}
                    {new Date(h.created_at).toLocaleDateString("en-IN")}
                  </p>
                ))}
              </div>
            ) : null}
          </AdminCard>
        ))}
      </div>
    </AdminLayout>
  );
}