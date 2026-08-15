import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, STATUS_LABEL } from "@/lib/mannu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logAdminAction } from "@/lib/admin-audit";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  head: () => ({
    meta: [
      { title: "Orders Master — Mannu Admin" },
      { name: "description", content: "Full platform order list with filters, manual delivery re-assignment, cancellations and refunds." },
      { property: "og:title", content: "Orders Master — Mannu Admin" },
      { property: "og:description", content: "Operate every order end to end from one screen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrdersMaster,
});

const FILTERS: { key: string; label: string; statuses: string[] }[] = [
  { key: "ALL", label: "All", statuses: [] },
  { key: "PENDING", label: "Pending", statuses: ["PLACED"] },
  { key: "PROCESSING", label: "Processing", statuses: ["ACCEPTED", "PREPARING", "READY"] },
  { key: "OUT", label: "Out for delivery", statuses: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
  { key: "DELIVERED", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "CANCELLED", label: "Cancelled", statuses: ["CANCELLED"] },
];

function OrdersMaster() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("ALL");
  const [refund, setRefund] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const { data: orders } = useQuery({
    queryKey: ["admin-orders-master", filter],
    refetchInterval: 15000,
    queryFn: async () => {
      const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? [];
      let q = supabase
        .from("orders")
        .select("id,order_no,status,total,payment_mode,placed_at,delivery_boy_id,delivery_address")
        .order("placed_at", { ascending: false })
        .limit(100);
      if (statuses.length) q = q.in("status", statuses as never[]);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: partners } = useQuery({
    queryKey: ["admin-partner-options"],
    queryFn: async () => {
      const { data: dps } = await supabase.from("delivery_profiles").select("user_id,is_online");
      const ids = (dps ?? []).map((d) => d.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name,phone").in("id", ids)
        : { data: [] };
      return (dps ?? []).map((d) => {
        const p = (profs ?? []).find((x) => x.id === d.user_id);
        return {
          id: d.user_id,
          label: `${p?.full_name || p?.phone || "Partner"}${d.is_online ? " · online" : ""}`,
        };
      });
    },
  });

  async function reassign(orderId: string, partnerId: string) {
    const { error } = await supabase
      .from("orders")
      .update({ delivery_boy_id: partnerId, status: "ASSIGNED" })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Delivery partner re-assigned");
    void qc.invalidateQueries({ queryKey: ["admin-orders-master"] });
  }

  async function cancel(orderId: string, refund: boolean) {
    const { error } = await supabase
      .from("orders")
      .update({ status: "CANCELLED" })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(refund ? "Order cancelled, refund initiated" : "Order cancelled");
    void qc.invalidateQueries({ queryKey: ["admin-orders-master"] });
  }

  const { data: disputes } = useQuery({
    queryKey: ["admin-disputes"],
    refetchInterval: 20000,
    queryFn: async () => {
      const { data } = await supabase
        .from("order_disputes")
        .select("*, orders(order_no,total,payment_mode)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function resolveDispute(
    id: string,
    status: "RESOLVED" | "REJECTED",
    mode: "WALLET" | "BANK" | null,
    amount: number,
  ) {
    const { error } = await supabase
      .from("order_disputes")
      .update({
        status,
        refund_amount: status === "RESOLVED" ? amount : 0,
        refund_mode: status === "RESOLVED" ? mode : null,
        resolution_note: note[id] ?? null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "RESOLVED" ? `Refund issued to ${mode?.toLowerCase()}` : "Dispute rejected");
    void logAdminAction("DISPUTE_" + status, "order_disputes", id, { amount, mode });
    void qc.invalidateQueries({ queryKey: ["admin-disputes"] });
  }

  return (
    <AdminLayout title="Orders Master" subtitle="Every order across the platform">
      <Tabs defaultValue="orders">
        <TabsList className="mb-4 grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="disputes">Disputes & refunds</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {(orders ?? []).map((o) => {
          const closed = o.status === "DELIVERED" || o.status === "CANCELLED";
          return (
            <AdminCard key={o.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{o.order_no}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.delivery_address}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(o.placed_at).toLocaleString("en-IN")} · {o.payment_mode}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  <p className="mt-1 text-sm font-bold text-primary">{inr(Number(o.total))}</p>
                </div>
              </div>

              {closed ? null : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    {...(o.delivery_boy_id ? { value: o.delivery_boy_id } : {})}
                    onValueChange={(v) => void reassign(o.id, v)}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Assign delivery partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {(partners ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => void cancel(o.id, false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void cancel(o.id, true)}>
                    Cancel & refund
                  </Button>
                </div>
              )}
            </AdminCard>
          );
        })}
        {!orders?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            No orders in this filter.
          </p>
        ) : null}
      </div>
        </TabsContent>

        <TabsContent value="disputes" className="space-y-3">
          {(disputes ?? []).map((d) => {
            const open = d.status === "OPEN" || d.status === "PENDING";
            const orderTotal = Number(d.orders?.total ?? 0);
            return (
              <AdminCard key={d.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{d.orders?.order_no ?? "Order"} · {d.reason}</p>
                    <p className="text-xs text-muted-foreground">{d.details ?? "No extra details"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Raised {new Date(d.created_at).toLocaleString("en-IN")} · Order value {inr(orderTotal)}
                    </p>
                  </div>
                  <Badge variant={open ? "default" : "secondary"}>{d.status}</Badge>
                </div>

                {open ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      type="number"
                      className="w-28"
                      placeholder="Refund ₹"
                      value={refund[d.id] ?? String(orderTotal)}
                      onChange={(e) => setRefund((r) => ({ ...r, [d.id]: e.target.value }))}
                    />
                    <Input
                      className="w-52"
                      placeholder="Resolution note"
                      value={note[d.id] ?? ""}
                      onChange={(e) => setNote((n) => ({ ...n, [d.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      onClick={() =>
                        void resolveDispute(d.id, "RESOLVED", "WALLET", Number(refund[d.id] ?? orderTotal) || 0)
                      }
                    >
                      Refund to wallet
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void resolveDispute(d.id, "RESOLVED", "BANK", Number(refund[d.id] ?? orderTotal) || 0)
                      }
                    >
                      Refund to bank
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void resolveDispute(d.id, "REJECTED", null, 0)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {Number(d.refund_amount) > 0
                      ? `Refunded ${inr(Number(d.refund_amount))} via ${d.refund_mode}`
                      : "No refund issued"}
                    {d.resolution_note ? ` · ${d.resolution_note}` : ""}
                  </p>
                )}
              </AdminCard>
            );
          })}
          {!disputes?.length ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No customer disputes raised.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}