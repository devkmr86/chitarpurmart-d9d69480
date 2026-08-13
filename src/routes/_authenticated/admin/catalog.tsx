import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/catalog")({
  head: () => ({
    meta: [
      { title: "Catalog & Categories — Mannu Admin" },
      { name: "description", content: "Manage global product categories, their commission defaults and measurement units." },
      { property: "og:title", content: "Catalog & Categories — Mannu Admin" },
      { property: "og:description", content: "Add, edit or remove categories and units used across all stores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Catalog,
});

function Catalog() {
  const qc = useQueryClient();
  const [cat, setCat] = useState({ name: "", icon: "ShoppingBasket", commission_pct: "10" });
  const [unit, setUnit] = useState({ name: "", short_name: "" });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: units } = useQuery({
    queryKey: ["admin-units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("*").order("name");
      return data ?? [];
    },
  });

  async function run(promise: PromiseLike<{ error: { message: string } | null }>, key: string, msg: string) {
    const { error } = await promise;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: [key] });
  }

  return (
    <AdminLayout title="Catalog & Categories" subtitle="Global categories and units">
      <Tabs defaultValue="categories">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="Category name"
                value={cat.name}
                onChange={(e) => setCat((c) => ({ ...c, name: e.target.value }))}
              />
              <Input
                className="w-44"
                placeholder="Lucide icon (e.g. Apple)"
                value={cat.icon}
                onChange={(e) => setCat((c) => ({ ...c, icon: e.target.value }))}
              />
              <Input
                className="w-28"
                type="number"
                placeholder="Comm %"
                value={cat.commission_pct}
                onChange={(e) => setCat((c) => ({ ...c, commission_pct: e.target.value }))}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!cat.name.trim()) {
                    toast.error("Enter a category name");
                    return;
                  }
                  void run(
                    supabase.from("categories").insert({
                      name: cat.name.trim(),
                      icon: cat.icon.trim() || "ShoppingBasket",
                      commission_pct: Number(cat.commission_pct) || 0,
                      sort_order: (categories?.length ?? 0) + 1,
                    }),
                    "admin-categories",
                    "Category added",
                  );
                  setCat({ name: "", icon: "ShoppingBasket", commission_pct: "10" });
                }}
              >
                Add category
              </Button>
            </div>
          </AdminCard>

          {(categories ?? []).map((c) => (
            <AdminCard key={c.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-40"
                  defaultValue={c.name}
                  onBlur={(e) =>
                    e.target.value !== c.name &&
                    void run(
                      supabase.from("categories").update({ name: e.target.value }).eq("id", c.id),
                      "admin-categories",
                      "Category updated",
                    )
                  }
                />
                <Input
                  className="w-28"
                  type="number"
                  defaultValue={String(c.commission_pct)}
                  onBlur={(e) =>
                    void run(
                      supabase
                        .from("categories")
                        .update({ commission_pct: Number(e.target.value) || 0 })
                        .eq("id", c.id),
                      "admin-categories",
                      "Commission updated",
                    )
                  }
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Active
                  <Switch
                    checked={c.is_active}
                    onCheckedChange={(v) =>
                      void run(
                        supabase.from("categories").update({ is_active: v }).eq("id", c.id),
                        "admin-categories",
                        "Category updated",
                      )
                    }
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    void run(
                      supabase.from("categories").delete().eq("id", c.id),
                      "admin-categories",
                      "Category deleted",
                    )
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </AdminCard>
          ))}
        </TabsContent>

        <TabsContent value="units" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="Unit name (Kilogram)"
                value={unit.name}
                onChange={(e) => setUnit((u) => ({ ...u, name: e.target.value }))}
              />
              <Input
                className="w-28"
                placeholder="Short (kg)"
                value={unit.short_name}
                onChange={(e) => setUnit((u) => ({ ...u, short_name: e.target.value }))}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!unit.name.trim() || !unit.short_name.trim()) {
                    toast.error("Enter unit name and short name");
                    return;
                  }
                  void run(
                    supabase.from("units").insert({ name: unit.name.trim(), short_name: unit.short_name.trim() }),
                    "admin-units",
                    "Unit added",
                  );
                  setUnit({ name: "", short_name: "" });
                }}
              >
                Add unit
              </Button>
            </div>
          </AdminCard>

          {(units ?? []).map((u) => (
            <AdminCard key={u.id}>
              <div className="flex items-center gap-3">
                <span className="flex-1 font-medium">{u.name} <span className="text-muted-foreground">({u.short_name})</span></span>
                <Switch
                  checked={u.is_active}
                  onCheckedChange={(v) =>
                    void run(supabase.from("units").update({ is_active: v }).eq("id", u.id), "admin-units", "Unit updated")
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void run(supabase.from("units").delete().eq("id", u.id), "admin-units", "Unit deleted")}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </AdminCard>
          ))}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}