import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Landmark, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard, StatCard } from "@/components/admin/AdminLayout";
import { MoneyInput } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { logAdminAction } from "@/lib/admin-audit";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/bank")({
  head: () => ({
    meta: [
      { title: "Bank & Settlement — Mannu Admin" },
      { name: "description", content: "Manage admin bank details and transfer accumulated platform revenue with a full settlement ledger." },
      { property: "og:title", content: "Bank & Settlement — Mannu Admin" },
      { property: "og:description", content: "Withdraw platform commission and track UTR-wise settlement history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BankPage,
});

function BankPage() {
  const qc = useQueryClient();
  const [bank, setBank] = useState({
    account_holder: "",
    bank_name: "",
    account_number: "",
    ifsc: "",
    upi_id: "",
  });
  const [amount, setAmount] = useState("");

  const { data: account } = useQuery({
    queryKey: ["admin-bank-account"],
    queryFn: async () =>
      (await supabase.from("admin_bank_accounts").select("*").order("created_at").limit(1).maybeSingle()).data,
  });

  const { data: settlements } = useQuery({
    queryKey: ["admin-settlements"],
    queryFn: async () =>
      (await supabase.from("admin_settlements").select("*").order("requested_at", { ascending: false })).data ?? [],
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue-pool"],
    queryFn: async () => {
      const [ordersRes, itemsRes, storesRes, catsRes] = await Promise.all([
        supabase.from("orders").select("id,platform_fee,status").eq("status", "DELIVERED"),
        supabase.from("order_items").select("order_id,store_id,line_total"),
        supabase.from("stores").select("id,commission_pct,category_id"),
        supabase.from("categories").select("id,commission_pct"),
      ]);
      const delivered = new Set((ordersRes.data ?? []).map((o) => o.id));
      const catPct = new Map((catsRes.data ?? []).map((c) => [c.id, Number(c.commission_pct)]));
      const storePct = new Map(
        (storesRes.data ?? []).map((s) => [
          s.id,
          s.commission_pct != null ? Number(s.commission_pct) : catPct.get(s.category_id ?? "") ?? 0,
        ]),
      );
      const commission = (itemsRes.data ?? [])
        .filter((i) => delivered.has(i.order_id))
        .reduce((sum, i) => sum + (Number(i.line_total) * (storePct.get(i.store_id) ?? 0)) / 100, 0);
      const fees = (ordersRes.data ?? []).reduce((s, o) => s + Number(o.platform_fee), 0);
      return { commission: Math.round(commission), fees: Math.round(fees) };
    },
  });

  useEffect(() => {
    if (!account) return;
    setBank({
      account_holder: account.account_holder ?? "",
      bank_name: account.bank_name ?? "",
      account_number: account.account_number ?? "",
      ifsc: account.ifsc ?? "",
      upi_id: account.upi_id ?? "",
    });
  }, [account]);

  const withdrawn = (settlements ?? [])
    .filter((s) => s.status !== "FAILED")
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const earned = (revenue?.commission ?? 0) + (revenue?.fees ?? 0);
  const available = Math.max(0, earned - withdrawn);

  async function saveBank() {
    const payload = { ...bank, updated_at: new Date().toISOString() };
    const res = account
      ? await supabase.from("admin_bank_accounts").update(payload).eq("id", account.id)
      : await supabase.from("admin_bank_accounts").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Bank details saved");
    void logAdminAction("UPDATE", "admin_bank_accounts", account?.id ?? null, {});
    void qc.invalidateQueries({ queryKey: ["admin-bank-account"] });
  }

  async function transfer() {
    const value = Number(amount) || available;
    if (value <= 0) {
      toast.error("Nothing available to transfer");
      return;
    }
    if (value > available) {
      toast.error("Amount exceeds available revenue");
      return;
    }
    if (!bank.account_number && !bank.upi_id) {
      toast.error("Add bank or UPI details first");
      return;
    }
    const { error } = await supabase.from("admin_settlements").insert({
      amount: value,
      status: "PENDING",
      bank_account_id: account?.id ?? null,
      note: bank.upi_id ? `UPI ${bank.upi_id}` : `A/c ****${bank.account_number.slice(-4)}`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Withdrawal requested");
    setAmount("");
    void logAdminAction("CREATE", "admin_settlements", null, { amount: value });
    void qc.invalidateQueries({ queryKey: ["admin-settlements"] });
  }

  async function markSettlement(id: string, status: string, utr: string) {
    const { error } = await supabase
      .from("admin_settlements")
      .update({
        status,
        utr: utr || null,
        completed_at: status === "COMPLETED" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settlement updated");
    void logAdminAction("UPDATE", "admin_settlements", id, { status });
    void qc.invalidateQueries({ queryKey: ["admin-settlements"] });
  }

  return (
    <AdminLayout title="Bank & Settlement" subtitle="Platform revenue withdrawals">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Commission earned" value={inr(revenue?.commission ?? 0)} icon={Wallet} />
        <StatCard label="Platform fees" value={inr(revenue?.fees ?? 0)} icon={Banknote} />
        <StatCard label="Available to transfer" value={inr(available)} hint={`Withdrawn ${inr(withdrawn)}`} icon={Landmark} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AdminCard>
          <p className="font-semibold">Admin bank details</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Account holder</Label>
              <Input value={bank.account_holder} onChange={(e) => setBank((b) => ({ ...b, account_holder: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Bank name</Label>
              <Input value={bank.bank_name} onChange={(e) => setBank((b) => ({ ...b, bank_name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Account number</Label>
              <Input value={bank.account_number} onChange={(e) => setBank((b) => ({ ...b, account_number: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">IFSC</Label>
              <Input value={bank.ifsc} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">UPI ID</Label>
              <Input value={bank.upi_id} onChange={(e) => setBank((b) => ({ ...b, upi_id: e.target.value }))} />
            </div>
          </div>
          <Button className="mt-3" size="sm" onClick={() => void saveBank()}>
            Save bank details
          </Button>
        </AdminCard>

        <AdminCard>
          <p className="font-semibold">Transfer revenue to bank</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Available balance {inr(available)}. Leave blank to withdraw everything.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MoneyInput className="w-40" value={amount} onChange={setAmount} placeholder={String(available)} />
            <Button size="sm" onClick={() => void transfer()}>
              Transfer to bank
            </Button>
          </div>
        </AdminCard>
      </div>

      <h2 className="mb-2 mt-6 font-display text-base font-bold">Settlement history</h2>
      <div className="space-y-3">
        {(settlements ?? []).map((s) => (
          <SettlementRow key={s.id} settlement={s} onUpdate={markSettlement} />
        ))}
        {!settlements?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No withdrawals yet.
          </p>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function SettlementRow({
  settlement,
  onUpdate,
}: {
  settlement: {
    id: string;
    amount: number;
    status: string;
    utr: string | null;
    note: string | null;
    requested_at: string;
  };
  onUpdate: (id: string, status: string, utr: string) => Promise<void>;
}) {
  const [utr, setUtr] = useState(settlement.utr ?? "");
  const done = settlement.status === "COMPLETED";
  return (
    <AdminCard>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{inr(Number(settlement.amount))}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(settlement.requested_at).toLocaleString("en-IN")} · {settlement.note ?? "—"}
          </p>
        </div>
        <Badge variant={done ? "default" : "secondary"}>{settlement.status}</Badge>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Input className="w-44" placeholder="UTR / Txn no." value={utr} onChange={(e) => setUtr(e.target.value)} />
          {done ? null : (
            <>
              <Button size="sm" onClick={() => void onUpdate(settlement.id, "COMPLETED", utr)}>
                Mark paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => void onUpdate(settlement.id, "FAILED", utr)}>
                Mark failed
              </Button>
            </>
          )}
        </div>
      </div>
    </AdminCard>
  );
}