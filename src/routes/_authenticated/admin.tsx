import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { inr, STATUS_LABEL } from "@/lib/mannu";
import { reviewRelocation, reviewRoleRequest } from "@/lib/mannu.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — Mannu A2Z Mart" },
      { name: "description", content: "Approve sellers and delivery partners, manage stores and monitor orders." },
      { property: "og:title", content: "Admin panel — Mannu A2Z Mart" },
      { property: "og:description", content: "Control centre for Mannu A2Z Mart operations." },
    ],
  }),
  component: AdminPanel,
});

function AdminPanel() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const reviewRole = useServerFn(reviewRoleRequest);
  const reviewMove = useServerFn(reviewRelocation);

  const { data: requests } = useQuery({
    queryKey: ["admin-role-requests"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("role_requests")
        .select("*")
        .eq("status", "PENDING")
        .order("created_at");
      return data ?? [];
    },
  });

  const { data: moves } = useQuery({
    queryKey: ["admin-relocations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_relocation_requests")
        .select("*")
        .eq("status", "PENDING");
      return data ?? [];
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("*").order("store_name");
      return data ?? [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,order_no,status,total,placed_at")
        .order("placed_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function decide(requestId: string, approve: boolean) {
    try {
      await reviewRole({ data: { requestId, approve } });
      toast.success(approve ? "Approved" : "Rejected");
      void qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function decideMove(requestId: string, approve: boolean) {
    try {
      await reviewMove({ data: { requestId, approve } });
      toast.success(approve ? "Relocation approved" : "Rejected");
      void qc.invalidateQueries({ queryKey: ["admin-relocations"] });
      void qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!roles.includes("ADMIN")) {
    return (
      <AppShell>
        <PageHeader title="Admin panel" />
        <p className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          Admins only.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Admin panel" subtitle="Approvals, stores and live orders" />
      <main className="mx-auto max-w-3xl px-4 py-4">
        <Tabs defaultValue="approvals">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="stores">Stores</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals" className="mt-4 space-y-3">
            {(requests ?? []).map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {r.requested_role === "SELLER" ? r.store_name : "Delivery partner"}
                  </span>
                  <Badge variant="secondary">{r.requested_role}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.address_line ?? `${r.id_doc_type ?? ""} ${r.id_doc_number ?? ""}`}
                  {r.vehicle_number ? ` · ${r.vehicle_number}` : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => decide(r.id, true)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => decide(r.id, false)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {(moves ?? []).map((m) => (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-semibold">Store relocation request</p>
                <p className="mt-1 text-xs text-muted-foreground">{m.new_address}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => decideMove(m.id, true)}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => decideMove(m.id, false)}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
            {!requests?.length && !moves?.length ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No pending approvals.
              </p>
            ) : null}
          </TabsContent>

          <TabsContent value="stores" className="mt-4 space-y-2">
            {(stores ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.store_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.address_line}</p>
                </div>
                <Switch
                  checked={s.is_active}
                  onCheckedChange={async (v) => {
                    await supabase.from("stores").update({ is_active: v }).eq("id", s.id);
                    void qc.invalidateQueries({ queryKey: ["admin-stores"] });
                  }}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="orders" className="mt-4 space-y-2">
            {(orders ?? []).map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
              >
                <div>
                  <p className="font-semibold">{o.order_no}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.placed_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  <p className="mt-1 text-sm font-bold text-primary">{inr(o.total)}</p>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </AppShell>
  );
}
