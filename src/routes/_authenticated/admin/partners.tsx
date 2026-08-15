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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logAdminAction } from "@/lib/admin-audit";

export const Route = createFileRoute("/_authenticated/admin/partners")({
  head: () => ({
    meta: [
      { title: "Delivery Partners — Mannu Admin" },
      { name: "description", content: "Track delivery partner duty status, cash in hand and settle COD collections." },
      { property: "og:title", content: "Delivery Partners — Mannu Admin" },
      { property: "og:description", content: "Monitor riders and settle cash collected from COD orders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartnersPage,
});

const BUSY = ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"];
const ACCOUNT_STATES = ["ACTIVE", "PAUSED", "BANNED"] as const;

function PartnersPage() {
  const qc = useQueryClient();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [txn, setTxn] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["admin-partners"],
    refetchInterval: 15000,
    queryFn: async () => {
      const [dpRes, activeRes] = await Promise.all([
        supabase.from("delivery_profiles").select("*"),
        supabase.from("orders").select("id,delivery_boy_id,status").in("status", BUSY as never[]),
      ]);
      const dps = dpRes.data ?? [];
      const ids = dps.map((d) => d.user_id);
      const profRes = ids.length
        ? await supabase.from("profiles").select("id,full_name,phone,account_status").in("id", ids)
        : { data: [] };
      const profiles = new Map((profRes.data ?? []).map((p) => [p.id, p]));
      const busy = new Set((activeRes.data ?? []).map((o) => o.delivery_boy_id));
      return dps.map((d) => ({
        ...d,
        name: profiles.get(d.user_id)?.full_name || "Partner",
        phone: profiles.get(d.user_id)?.phone ?? "",
        account_status: profiles.get(d.user_id)?.account_status ?? "ACTIVE",
        state: busy.has(d.user_id) ? "ON DELIVERY" : d.is_online ? "ONLINE" : "OFFLINE",
      }));
    },
  });

  async function setAccountStatus(userId: string, status: string) {
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Partner ${status.toLowerCase()}`);
    void logAdminAction("PARTNER_MODERATION", "profiles", userId, { account_status: status });
    void qc.invalidateQueries({ queryKey: ["admin-partners"] });
  }

  const { data: settlements } = useQuery({
    queryKey: ["admin-cash-settlements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_cash_settlements")
        .select("*")
        .order("settled_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  async function settle(userId: string, cashInHand: number) {
    const raw = amounts[userId];
    const amount = raw ? Number(raw) : cashInHand;
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const ins = await supabase.from("delivery_cash_settlements").insert({
      delivery_boy_id: userId,
      amount,
      transaction_id: txn[userId] ?? null,
    });
    if (ins.error) {
      toast.error(ins.error.message);
      return;
    }
    const upd = await supabase
      .from("delivery_profiles")
      .update({ cash_in_hand: Math.max(0, cashInHand - amount) })
      .eq("user_id", userId);
    if (upd.error) {
      toast.error(upd.error.message);
      return;
    }
    toast.success("Cash settled");
    setAmounts((a) => ({ ...a, [userId]: "" }));
    setTxn((t) => ({ ...t, [userId]: "" }));
    void qc.invalidateQueries({ queryKey: ["admin-partners"] });
    void qc.invalidateQueries({ queryKey: ["admin-cash-settlements"] });
  }

  return (
    <AdminLayout title="Delivery Partners" subtitle="Duty status, cash in hand and settlements">
      <div className="grid gap-3 lg:grid-cols-2">
        {(data ?? []).map((p) => (
          <AdminCard key={p.user_id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.phone} · {p.vehicle_number ?? "No vehicle"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Earnings: {inr(Number(p.total_earnings))}
                </p>
              </div>
              <Badge variant={p.state === "OFFLINE" ? "secondary" : "default"}>{p.state}</Badge>
            </div>
            <p className="mt-2 text-sm font-bold text-primary">
              Cash in hand: {inr(Number(p.cash_in_hand))}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                type="number"
                className="w-28"
                placeholder="Amount"
                value={amounts[p.user_id] ?? ""}
                onChange={(e) => setAmounts((a) => ({ ...a, [p.user_id]: e.target.value }))}
              />
              <Input
                className="w-36"
                placeholder="Txn ID"
                value={txn[p.user_id] ?? ""}
                onChange={(e) => setTxn((t) => ({ ...t, [p.user_id]: e.target.value }))}
              />
              <Button size="sm" onClick={() => void settle(p.user_id, Number(p.cash_in_hand))}>
                Settle cash
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Account</span>
              <Select value={p.account_status} onValueChange={(v) => void setAccountStatus(p.user_id, v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_STATES.map((st) => (
                    <SelectItem key={st} value={st}>{st}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AdminCard>
        ))}
        {!data?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            No delivery partners yet.
          </p>
        ) : null}
      </div>

      <AdminCard className="mt-4">
        <h2 className="font-display text-base font-bold">Recent settlements</h2>
        <div className="mt-3 space-y-2">
          {(settlements ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {new Date(s.settled_at).toLocaleString("en-IN")} · {s.transaction_id ?? "cash"}
              </span>
              <span className="font-semibold">{inr(Number(s.amount))}</span>
            </div>
          ))}
          {!settlements?.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No settlements recorded.</p>
          ) : null}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}