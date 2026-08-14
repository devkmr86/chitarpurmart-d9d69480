import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { MoneyInput } from "@/components/admin/ImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logAdminAction } from "@/lib/admin-audit";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Mannu Admin" },
      { name: "description", content: "Configure delivery slabs, platform fees, COD limits and surge rules for Mannu A2Z Mart." },
      { property: "og:title", content: "Platform Settings — Mannu Admin" },
      { property: "og:description", content: "Global configuration for fees, delivery pricing and limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

type Charges = {
  platform_fee: string;
  night_amount: string;
  night_start: string;
  night_end: string;
  free_delivery_above: string;
  cod_cash_limit: string;
  max_batch_radius_km: string;
  surge_active: boolean;
  surge_multiplier: string;
  maintenance_active: boolean;
  maintenance_message: string;
};

const EMPTY: Charges = {
  platform_fee: "0",
  night_amount: "0",
  night_start: "22",
  night_end: "6",
  free_delivery_above: "0",
  cod_cash_limit: "0",
  max_batch_radius_km: "12",
  surge_active: false,
  surge_multiplier: "1",
  maintenance_active: false,
  maintenance_message: "",
};

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Settings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Charges>(EMPTY);
  const [slab, setSlab] = useState({ min_km: "", max_km: "", charge: "" });
  const [payout, setPayout] = useState({ min_km: "", max_km: "", base_pay: "", per_km: "" });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("system_settings").select("*").order("key")).data ?? [],
  });

  const { data: slabs } = useQuery({
    queryKey: ["admin-delivery-slabs"],
    queryFn: async () =>
      (await supabase.from("delivery_slabs").select("*").order("min_km")).data ?? [],
  });

  const { data: payoutSlabs } = useQuery({
    queryKey: ["admin-payout-slabs"],
    queryFn: async () =>
      (await supabase.from("delivery_payout_slabs").select("*").order("min_km")).data ?? [],
  });

  const { data: logs } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () =>
      (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(60)).data ?? [],
  });

  useEffect(() => {
    if (!settings?.length) return;
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value as Record<string, unknown>]));
    const night = (map["night_charge"] ?? {}) as Record<string, unknown>;
    const surge = (map["surge"] ?? {}) as Record<string, unknown>;
    const maint = (map["maintenance_mode"] ?? {}) as Record<string, unknown>;
    setForm({
      platform_fee: String(num((map["platform_fee"] as Record<string, unknown>)?.["amount"])),
      night_amount: String(num(night["amount"])),
      night_start: String(num(night["start_hour"], 22)),
      night_end: String(num(night["end_hour"], 6)),
      free_delivery_above: String(num((map["free_delivery_above"] as Record<string, unknown>)?.["amount"])),
      cod_cash_limit: String(num((map["cod_cash_limit"] as Record<string, unknown>)?.["amount"])),
      max_batch_radius_km: String(num((map["max_batch_radius_km"] as Record<string, unknown>)?.["value"], 12)),
      surge_active: Boolean(surge["active"]),
      surge_multiplier: String(num(surge["multiplier"], 1)),
      maintenance_active: Boolean(maint["active"]),
      maintenance_message: String(maint["message"] ?? ""),
    });
  }, [settings]);

  async function setKey(key: string, value: unknown) {
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { key, value: value as never, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  }

  async function saveCharges() {
    try {
      await setKey("platform_fee", { amount: Number(form.platform_fee) || 0 });
      await setKey("night_charge", {
        amount: Number(form.night_amount) || 0,
        start_hour: Number(form.night_start) || 0,
        end_hour: Number(form.night_end) || 0,
      });
      await setKey("free_delivery_above", { amount: Number(form.free_delivery_above) || 0 });
      await setKey("cod_cash_limit", { amount: Number(form.cod_cash_limit) || 0 });
      await setKey("max_batch_radius_km", { value: Number(form.max_batch_radius_km) || 12 });
      await setKey("surge", {
        active: form.surge_active,
        multiplier: Number(form.surge_multiplier) || 1,
      });
      toast.success("Charges saved");
      void logAdminAction("UPDATE", "system_settings", null, { section: "charges" });
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function saveMaintenance(active: boolean, message: string) {
    try {
      await setKey("maintenance_mode", { active, message });
      toast.success(active ? "Maintenance mode ON" : "Maintenance mode OFF");
      void logAdminAction("UPDATE", "maintenance_mode", null, { active });
      void qc.invalidateQueries({ queryKey: ["admin-settings"] });
      void qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function run(
    p: PromiseLike<{ error: { message: string } | null }>,
    key: string,
    msg: string,
    audit?: { action: string; entity: string },
  ) {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    if (audit) void logAdminAction(audit.action, audit.entity, null, {});
    void qc.invalidateQueries({ queryKey: [key] });
    void qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
  }

  return (
    <AdminLayout title="Platform Settings" subtitle="Charges, delivery slabs, payouts and system controls">
      <Tabs defaultValue="charges">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="slabs">Delivery slabs</TabsTrigger>
          <TabsTrigger value="payout">Partner payout</TabsTrigger>
          <TabsTrigger value="system">System & audit</TabsTrigger>
        </TabsList>

        <TabsContent value="charges" className="mt-4 grid gap-3 lg:grid-cols-2">
          <AdminCard>
            <p className="font-semibold">Customer extra charges</p>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Platform fee per order</Label>
                <MoneyInput value={form.platform_fee} onChange={(v) => setForm((f) => ({ ...f, platform_fee: v }))} />
              </div>
              <div>
                <Label className="text-xs">Night charge</Label>
                <MoneyInput value={form.night_amount} onChange={(v) => setForm((f) => ({ ...f, night_amount: v }))} />
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    className="w-20"
                    type="number"
                    value={form.night_start}
                    onChange={(e) => setForm((f) => ({ ...f, night_start: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    className="w-20"
                    type="number"
                    value={form.night_end}
                    onChange={(e) => setForm((f) => ({ ...f, night_end: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Free delivery above cart value</Label>
                <MoneyInput
                  value={form.free_delivery_above}
                  onChange={(v) => setForm((f) => ({ ...f, free_delivery_above: v }))}
                />
              </div>
            </div>
          </AdminCard>

          <AdminCard>
            <p className="font-semibold">Operations limits</p>
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs">Max cash-in-hand per rider</Label>
                <MoneyInput value={form.cod_cash_limit} onChange={(v) => setForm((f) => ({ ...f, cod_cash_limit: v }))} />
              </div>
              <div>
                <Label className="text-xs">Service radius (km)</Label>
                <Input
                  type="number"
                  value={form.max_batch_radius_km}
                  onChange={(e) => setForm((f) => ({ ...f, max_batch_radius_km: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Surge pricing</p>
                  <p className="text-xs text-muted-foreground">Multiply delivery charge during rush</p>
                </div>
                <Switch
                  checked={form.surge_active}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, surge_active: v }))}
                />
              </div>
              <div>
                <Label className="text-xs">Surge multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.surge_multiplier}
                  onChange={(e) => setForm((f) => ({ ...f, surge_multiplier: e.target.value }))}
                />
              </div>
            </div>
          </AdminCard>

          <div className="lg:col-span-2">
            <Button onClick={() => void saveCharges()}>Save charges</Button>
          </div>
        </TabsContent>

        <TabsContent value="slabs" className="mt-4 space-y-3">
          <AdminCard>
            <p className="mb-2 font-semibold">Add distance slab</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">From km</Label>
                <Input className="w-24" type="number" value={slab.min_km} onChange={(e) => setSlab((s) => ({ ...s, min_km: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">To km</Label>
                <Input className="w-24" type="number" value={slab.max_km} onChange={(e) => setSlab((s) => ({ ...s, max_km: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Charge</Label>
                <MoneyInput className="w-32" value={slab.charge} onChange={(v) => setSlab((s) => ({ ...s, charge: v }))} />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!slab.max_km) {
                    toast.error("Enter the upper distance limit");
                    return;
                  }
                  void run(
                    supabase.from("delivery_slabs").insert({
                      min_km: Number(slab.min_km) || 0,
                      max_km: Number(slab.max_km),
                      charge: Number(slab.charge) || 0,
                    }),
                    "admin-delivery-slabs",
                    "Slab added",
                    { action: "CREATE", entity: "delivery_slabs" },
                  );
                  setSlab({ min_km: "", max_km: "", charge: "" });
                }}
              >
                Add slab
              </Button>
            </div>
          </AdminCard>

          {(slabs ?? []).map((s) => (
            <AdminCard key={s.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-24"
                  type="number"
                  defaultValue={String(s.min_km)}
                  onBlur={(e) =>
                    void run(
                      supabase.from("delivery_slabs").update({ min_km: Number(e.target.value) || 0 }).eq("id", s.id),
                      "admin-delivery-slabs",
                      "Slab updated",
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  className="w-24"
                  type="number"
                  defaultValue={String(s.max_km)}
                  onBlur={(e) =>
                    void run(
                      supabase.from("delivery_slabs").update({ max_km: Number(e.target.value) || 0 }).eq("id", s.id),
                      "admin-delivery-slabs",
                      "Slab updated",
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">km →</span>
                <MoneyInput
                  className="w-32"
                  value={String(s.charge)}
                  onChange={(v) =>
                    void run(
                      supabase.from("delivery_slabs").update({ charge: Number(v) || 0 }).eq("id", s.id),
                      "admin-delivery-slabs",
                      "Charge updated",
                    )
                  }
                />
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active</span>
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) =>
                      void run(
                        supabase.from("delivery_slabs").update({ is_active: v }).eq("id", s.id),
                        "admin-delivery-slabs",
                        "Slab updated",
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(
                        supabase.from("delivery_slabs").delete().eq("id", s.id),
                        "admin-delivery-slabs",
                        "Slab deleted",
                        { action: "DELETE", entity: "delivery_slabs" },
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        <TabsContent value="payout" className="mt-4 space-y-3">
          <AdminCard>
            <p className="mb-2 font-semibold">Add delivery partner payout slab</p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">From km</Label>
                <Input className="w-24" type="number" value={payout.min_km} onChange={(e) => setPayout((s) => ({ ...s, min_km: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">To km</Label>
                <Input className="w-24" type="number" value={payout.max_km} onChange={(e) => setPayout((s) => ({ ...s, max_km: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Base pay</Label>
                <MoneyInput className="w-32" value={payout.base_pay} onChange={(v) => setPayout((s) => ({ ...s, base_pay: v }))} />
              </div>
              <div>
                <Label className="text-xs">Per km</Label>
                <MoneyInput className="w-28" value={payout.per_km} onChange={(v) => setPayout((s) => ({ ...s, per_km: v }))} />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!payout.max_km) {
                    toast.error("Enter the upper distance limit");
                    return;
                  }
                  void run(
                    supabase.from("delivery_payout_slabs").insert({
                      min_km: Number(payout.min_km) || 0,
                      max_km: Number(payout.max_km),
                      base_pay: Number(payout.base_pay) || 0,
                      per_km: Number(payout.per_km) || 0,
                    }),
                    "admin-payout-slabs",
                    "Payout slab added",
                    { action: "CREATE", entity: "delivery_payout_slabs" },
                  );
                  setPayout({ min_km: "", max_km: "", base_pay: "", per_km: "" });
                }}
              >
                Add payout slab
              </Button>
            </div>
          </AdminCard>

          {(payoutSlabs ?? []).map((s) => (
            <AdminCard key={s.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">
                  {Number(s.min_km)}–{Number(s.max_km)} km
                </span>
                <MoneyInput
                  className="w-32"
                  value={String(s.base_pay)}
                  onChange={(v) =>
                    void run(
                      supabase.from("delivery_payout_slabs").update({ base_pay: Number(v) || 0 }).eq("id", s.id),
                      "admin-payout-slabs",
                      "Base pay updated",
                    )
                  }
                />
                <MoneyInput
                  className="w-28"
                  value={String(s.per_km)}
                  onChange={(v) =>
                    void run(
                      supabase.from("delivery_payout_slabs").update({ per_km: Number(v) || 0 }).eq("id", s.id),
                      "admin-payout-slabs",
                      "Per km updated",
                    )
                  }
                />
                <span className="text-xs text-muted-foreground">per km</span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) =>
                      void run(
                        supabase.from("delivery_payout_slabs").update({ is_active: v }).eq("id", s.id),
                        "admin-payout-slabs",
                        "Payout slab updated",
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      void run(
                        supabase.from("delivery_payout_slabs").delete().eq("id", s.id),
                        "admin-payout-slabs",
                        "Payout slab removed",
                        { action: "DELETE", entity: "delivery_payout_slabs" },
                      )
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        <TabsContent value="system" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Maintenance mode</p>
                <p className="text-xs text-muted-foreground">Pause new orders across the storefront</p>
              </div>
              <Switch
                checked={form.maintenance_active}
                onCheckedChange={(v) => {
                  setForm((f) => ({ ...f, maintenance_active: v }));
                  void saveMaintenance(v, form.maintenance_message);
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="max-w-md"
                placeholder="Message shown to customers"
                value={form.maintenance_message}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_message: e.target.value }))}
              />
              <Button size="sm" variant="outline" onClick={() => void saveMaintenance(form.maintenance_active, form.maintenance_message)}>
                Save message
              </Button>
            </div>
          </AdminCard>

          <AdminCard>
            <p className="font-semibold">Action audit log</p>
            <div className="mt-3 divide-y divide-border text-sm">
              {(logs ?? []).map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">{l.action}</span>
                  <span className="text-xs">{l.entity}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
              {!logs?.length ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No admin actions recorded yet.</p>
              ) : null}
            </div>
          </AdminCard>

          <AdminCard>
            <p className="text-xs text-muted-foreground">
              Current platform fee {inr(Number(form.platform_fee) || 0)} · free delivery above{" "}
              {inr(Number(form.free_delivery_above) || 0)}
            </p>
          </AdminCard>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}