import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

function Settings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("system_settings").select("*").order("key")).data ?? [],
  });

  async function save(key: string, fallback: unknown) {
    const raw = draft[key];
    let value: unknown = fallback;
    if (raw !== undefined) {
      try {
        value = JSON.parse(raw);
      } catch {
        toast.error("Invalid JSON value");
        return;
      }
    }
    const { error } = await supabase
      .from("system_settings")
      .update({ value: value as never, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Setting saved");
    void qc.invalidateQueries({ queryKey: ["admin-settings"] });
  }

  return (
    <AdminLayout title="Platform Settings" subtitle="Fees, delivery slabs and limits">
      <div className="grid gap-3 lg:grid-cols-2">
        {(settings ?? []).map((s) => (
          <AdminCard key={s.key}>
            <p className="font-semibold">{s.key.replace(/_/g, " ")}</p>
            {s.description ? (
              <p className="text-xs text-muted-foreground">{s.description}</p>
            ) : null}
            <Textarea
              className="mt-2 font-mono text-xs"
              rows={4}
              defaultValue={JSON.stringify(s.value, null, 2)}
              onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
            />
            <Button size="sm" className="mt-2" onClick={() => void save(s.key, s.value)}>
              Save
            </Button>
          </AdminCard>
        ))}
        {!settings?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground lg:col-span-2">
            No settings configured.
          </p>
        ) : null}
      </div>
    </AdminLayout>
  );
}