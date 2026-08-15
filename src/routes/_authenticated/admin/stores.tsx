import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logAdminAction } from "@/lib/admin-audit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/stores")({
  head: () => ({
    meta: [
      { title: "Stores Management — Mannu Admin" },
      { name: "description", content: "Master list of registered stores with status control and per-store commission settings." },
      { property: "og:title", content: "Stores Management — Mannu Admin" },
      { property: "og:description", content: "Open, close or suspend stores and set commission rates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoresPage,
});

const STATUSES = ["OPEN", "CLOSED", "SUSPENDED"] as const;
const ACCOUNT_STATES = ["ACTIVE", "PAUSED", "BANNED"] as const;

function StoresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pct, setPct] = useState<Record<string, string>>({});

  const { data: stores } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id,seller_id,store_name,address_line,is_active,store_status,commission_pct,rating,categories(name)")
        .order("store_name");
      return data ?? [];
    },
  });

  const sellerIds = (stores ?? []).map((s) => s.seller_id).filter((x): x is string => !!x);

  const { data: sellers } = useQuery({
    queryKey: ["admin-store-sellers", sellerIds.join(",")],
    enabled: sellerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,phone,account_status")
        .in("id", sellerIds);
      return data ?? [];
    },
  });

  async function update(
    id: string,
    patch: { store_status?: string; is_active?: boolean; commission_pct?: number | null },
  ) {
    const { error } = await supabase.from("stores").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Store updated");
    void logAdminAction("STORE_UPDATE", "stores", id, patch as Record<string, unknown>);
    void qc.invalidateQueries({ queryKey: ["admin-stores"] });
  }

  async function setSellerStatus(sellerId: string, status: string) {
    const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", sellerId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Seller ${status.toLowerCase()}`);
    void logAdminAction("SELLER_MODERATION", "profiles", sellerId, { account_status: status });
    void qc.invalidateQueries({ queryKey: ["admin-store-sellers"] });
  }

  const list = (stores ?? []).filter((s) =>
    s.store_name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <AdminLayout title="Stores Management" subtitle="Status control and commission per store">
      <Input
        placeholder="Search stores…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4 max-w-sm"
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((s) => {
          const status = s.store_status;
          const seller = (sellers ?? []).find((p) => p.id === s.seller_id);
          return (
            <AdminCard key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{s.store_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.address_line}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.categories?.name ?? "Uncategorised"} · ★ {Number(s.rating).toFixed(1)}
                  </p>
                </div>
                <Badge variant={status === "OPEN" ? "default" : "secondary"}>{status}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={status}
                  onValueChange={(v) => update(s.id, { store_status: v, is_active: v === "OPEN" })}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24"
                    placeholder="Comm %"
                    value={pct[s.id] ?? (s.commission_pct != null ? String(s.commission_pct) : "")}
                    onChange={(e) => setPct((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const raw = pct[s.id];
                      const value = raw === undefined || raw === "" ? null : Number(raw);
                      if (value !== null && (Number.isNaN(value) || value < 0 || value > 100)) {
                        toast.error("Commission must be 0–100");
                        return;
                      }
                      void update(s.id, { commission_pct: value });
                    }}
                  >
                    Save commission
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Leave commission blank to use the category default.
              </p>

              {seller ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    Seller: {seller.full_name || seller.phone}
                  </span>
                  <Select
                    value={seller.account_status}
                    onValueChange={(v) => void setSellerStatus(seller.id, v)}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_STATES.map((st) => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </AdminCard>
          );
        })}
        {!list.length ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            No stores found.
          </p>
        ) : null}
      </div>
    </AdminLayout>
  );
}