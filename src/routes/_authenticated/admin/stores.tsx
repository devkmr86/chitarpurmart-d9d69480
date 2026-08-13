import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function StoresPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [pct, setPct] = useState<Record<string, string>>({});

  const { data: stores } = useQuery({
    queryKey: ["admin-stores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id,store_name,address_line,is_active,store_status,commission_pct,rating,categories(name)")
        .order("store_name");
      return data ?? [];
    },
  });

  async function update(id: string, patch: Record<string, unknown>) {
    const { error } = await supabase.from("stores").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Store updated");
    void qc.invalidateQueries({ queryKey: ["admin-stores"] });
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