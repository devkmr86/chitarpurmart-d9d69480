import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { reviewRelocation, reviewRoleRequest } from "@/lib/mannu.functions";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals & Onboarding — Mannu Admin" },
      { name: "description", content: "Review and approve seller shops, delivery partners and store relocation requests." },
      { property: "og:title", content: "Approvals & Onboarding — Mannu Admin" },
      { property: "og:description", content: "One-click approve or reject partner applications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Approvals,
});

function Approvals() {
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

  async function decide(requestId: string, approve: boolean) {
    try {
      await reviewRole({ data: { requestId, approve } });
      toast.success(approve ? "Application approved" : "Application rejected");
      void qc.invalidateQueries({ queryKey: ["admin-role-requests"] });
      void qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function decideMove(requestId: string, approve: boolean) {
    try {
      await reviewMove({ data: { requestId, approve } });
      toast.success(approve ? "Relocation approved" : "Relocation rejected");
      void qc.invalidateQueries({ queryKey: ["admin-relocations"] });
      void qc.invalidateQueries({ queryKey: ["admin-stores"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const sellers = (requests ?? []).filter((r) => r.requested_role === "SELLER");
  const partners = (requests ?? []).filter((r) => r.requested_role === "DELIVERY");

  return (
    <AdminLayout title="Approvals & Onboarding" subtitle="Sellers, delivery partners and relocations">
      <Tabs defaultValue="sellers">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sellers">Sellers ({sellers.length})</TabsTrigger>
          <TabsTrigger value="partners">Delivery ({partners.length})</TabsTrigger>
          <TabsTrigger value="moves">Relocations ({moves?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="sellers" className="mt-4 grid gap-3 lg:grid-cols-2">
          {sellers.map((r) => (
            <AdminCard key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.store_name ?? "Unnamed shop"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.address_line ?? "No address"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Document: {r.id_doc_type ?? "—"} {r.id_doc_number ?? ""}
                  </p>
                  {r.note ? <p className="mt-1 text-xs text-muted-foreground">Note: {r.note}</p> : null}
                </div>
                <Badge variant="secondary">SELLER</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decide(r.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            </AdminCard>
          ))}
          {!sellers.length ? <Empty label="No pending seller applications." /> : null}
        </TabsContent>

        <TabsContent value="partners" className="mt-4 grid gap-3 lg:grid-cols-2">
          {partners.map((r) => (
            <AdminCard key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">Delivery partner</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ID: {r.id_doc_type ?? "—"} {r.id_doc_number ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Vehicle: {r.vehicle_number ?? "—"}</p>
                </div>
                <Badge variant="secondary">DELIVERY</Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decide(r.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            </AdminCard>
          ))}
          {!partners.length ? <Empty label="No pending delivery applications." /> : null}
        </TabsContent>

        <TabsContent value="moves" className="mt-4 grid gap-3 lg:grid-cols-2">
          {(moves ?? []).map((m) => (
            <AdminCard key={m.id}>
              <p className="font-semibold">Store relocation</p>
              <p className="mt-1 text-xs text-muted-foreground">From: {m.old_address}</p>
              <p className="text-xs text-muted-foreground">To: {m.new_address}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decideMove(m.id, true)}>Approve</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => decideMove(m.id, false)}>Reject</Button>
              </div>
            </AdminCard>
          ))}
          {!moves?.length ? <Empty label="No pending relocation requests." /> : null}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
      {label}
    </p>
  );
}