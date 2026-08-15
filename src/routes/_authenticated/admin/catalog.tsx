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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload, MoneyInput } from "@/components/admin/ImageUpload";
import { logAdminAction } from "@/lib/admin-audit";
import { inr } from "@/lib/mannu";

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
  const [shopType, setShopType] = useState({ name: "", icon: "Store", image_url: null as string | null });
  const [storeId, setStoreId] = useState<string>("");
  const [prod, setProd] = useState({ product_name: "", price: "", stock_qty: "10", image_url: null as string | null });

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

  const { data: shopTypes } = useQuery({
    queryKey: ["admin-shop-types"],
    queryFn: async () => {
      const { data } = await supabase.from("shop_types").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: storeList } = useQuery({
    queryKey: ["admin-store-options"],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id,store_name").order("store_name");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-store-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,product_name,description,price,mrp,stock_qty,is_available,image_url")
        .eq("store_id", storeId)
        .order("product_name");
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

  async function addProduct() {
    if (!storeId) {
      toast.error("Pick a store first");
      return;
    }
    if (!prod.product_name.trim() || !Number(prod.price)) {
      toast.error("Enter product name and price");
      return;
    }
    await run(
      supabase.from("products").insert({
        store_id: storeId,
        product_name: prod.product_name.trim(),
        price: Number(prod.price),
        stock_qty: Number(prod.stock_qty) || 0,
        image_url: prod.image_url,
      }),
      "admin-store-products",
      "Product added",
    );
    void logAdminAction("PRODUCT_CREATE", "products", storeId, { name: prod.product_name });
    setProd({ product_name: "", price: "", stock_qty: "10", image_url: null });
  }

  return (
    <AdminLayout title="Catalog & Categories" subtitle="Global categories and units">
      <Tabs defaultValue="categories">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="shoptypes">Shop types</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
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
                <ImageUpload
                  value={c.image_url}
                  folder="categories"
                  onChange={(url) =>
                    void run(
                      supabase.from("categories").update({ image_url: url }).eq("id", c.id),
                      "admin-categories",
                      "Category image updated",
                    )
                  }
                />
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

        <TabsContent value="shoptypes" className="mt-4 space-y-3">
          <AdminCard>
            <div className="flex flex-wrap items-center gap-2">
              <ImageUpload
                value={shopType.image_url}
                folder="shop-types"
                onChange={(url) => setShopType((s) => ({ ...s, image_url: url }))}
              />
              <Input
                className="w-44"
                placeholder="Shop type (Grocery)"
                value={shopType.name}
                onChange={(e) => setShopType((s) => ({ ...s, name: e.target.value }))}
              />
              <Input
                className="w-40"
                placeholder="Lucide icon (Store)"
                value={shopType.icon}
                onChange={(e) => setShopType((s) => ({ ...s, icon: e.target.value }))}
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!shopType.name.trim()) {
                    toast.error("Enter a shop type name");
                    return;
                  }
                  void run(
                    supabase.from("shop_types").insert({
                      name: shopType.name.trim(),
                      icon: shopType.icon.trim() || "Store",
                      image_url: shopType.image_url,
                      sort_order: (shopTypes?.length ?? 0) + 1,
                    }),
                    "admin-shop-types",
                    "Shop type added",
                  );
                  setShopType({ name: "", icon: "Store", image_url: null });
                }}
              >
                Add shop type
              </Button>
            </div>
          </AdminCard>

          {(shopTypes ?? []).map((t) => (
            <AdminCard key={t.id}>
              <div className="flex flex-wrap items-center gap-2">
                <ImageUpload
                  value={t.image_url}
                  folder="shop-types"
                  onChange={(url) =>
                    void run(
                      supabase.from("shop_types").update({ image_url: url }).eq("id", t.id),
                      "admin-shop-types",
                      "Shop type image updated",
                    )
                  }
                />
                <Input
                  className="w-44"
                  defaultValue={t.name}
                  onBlur={(e) =>
                    e.target.value !== t.name &&
                    void run(
                      supabase.from("shop_types").update({ name: e.target.value }).eq("id", t.id),
                      "admin-shop-types",
                      "Shop type updated",
                    )
                  }
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Active
                  <Switch
                    checked={t.is_active}
                    onCheckedChange={(v) =>
                      void run(
                        supabase.from("shop_types").update({ is_active: v }).eq("id", t.id),
                        "admin-shop-types",
                        "Shop type updated",
                      )
                    }
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    void run(
                      supabase.from("shop_types").delete().eq("id", t.id),
                      "admin-shop-types",
                      "Shop type deleted",
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

        <TabsContent value="inventory" className="mt-4 space-y-3">
          <AdminCard>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Select a store to manage products" />
              </SelectTrigger>
              <SelectContent>
                {(storeList ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </AdminCard>

          {storeId ? (
            <>
              <AdminCard>
                <div className="flex flex-wrap items-end gap-2">
                  <ImageUpload
                    value={prod.image_url}
                    folder="products"
                    onChange={(url) => setProd((p) => ({ ...p, image_url: url }))}
                  />
                  <Input
                    className="w-44"
                    placeholder="Product name"
                    value={prod.product_name}
                    onChange={(e) => setProd((p) => ({ ...p, product_name: e.target.value }))}
                  />
                  <MoneyInput
                    className="w-28"
                    value={prod.price}
                    onChange={(v) => setProd((p) => ({ ...p, price: v }))}
                    placeholder="Price"
                  />
                  <Input
                    className="w-24"
                    type="number"
                    placeholder="Stock"
                    value={prod.stock_qty}
                    onChange={(e) => setProd((p) => ({ ...p, stock_qty: e.target.value }))}
                  />
                  <Button size="sm" onClick={() => void addProduct()}>Add product</Button>
                </div>
              </AdminCard>

              {(products ?? []).map((p) => (
                <AdminCard key={p.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <ImageUpload
                      value={p.image_url}
                      folder="products"
                      onChange={(url) =>
                        void run(
                          supabase.from("products").update({ image_url: url }).eq("id", p.id),
                          "admin-store-products",
                          "Product image updated",
                        )
                      }
                    />
                    <Input
                      className="w-44"
                      defaultValue={p.product_name}
                      onBlur={(e) =>
                        e.target.value !== p.product_name &&
                        void run(
                          supabase.from("products").update({ product_name: e.target.value }).eq("id", p.id),
                          "admin-store-products",
                          "Product updated",
                        )
                      }
                    />
                    <Input
                      className="w-52"
                      placeholder="Description"
                      defaultValue={p.description ?? ""}
                      onBlur={(e) =>
                        e.target.value !== (p.description ?? "") &&
                        void run(
                          supabase.from("products").update({ description: e.target.value }).eq("id", p.id),
                          "admin-store-products",
                          "Product updated",
                        )
                      }
                    />
                    <MoneyInput
                      className="w-28"
                      value={String(p.price)}
                      onChange={() => undefined}
                      placeholder="Price"
                    />
                    <Input
                      className="w-24"
                      type="number"
                      defaultValue={String(p.price)}
                      onBlur={(e) =>
                        Number(e.target.value) !== Number(p.price) &&
                        void run(
                          supabase.from("products").update({ price: Number(e.target.value) || 0 }).eq("id", p.id),
                          "admin-store-products",
                          "Price updated",
                        )
                      }
                    />
                    <Input
                      className="w-24"
                      type="number"
                      defaultValue={String(p.stock_qty)}
                      onBlur={(e) =>
                        Number(e.target.value) !== Number(p.stock_qty) &&
                        void run(
                          supabase
                            .from("products")
                            .update({ stock_qty: Number(e.target.value) || 0 })
                            .eq("id", p.id),
                          "admin-store-products",
                          "Stock updated",
                        )
                      }
                    />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      In stock
                      <Switch
                        checked={p.is_available}
                        onCheckedChange={(v) =>
                          void run(
                            supabase.from("products").update({ is_available: v }).eq("id", p.id),
                            "admin-store-products",
                            v ? "Marked in stock" : "Marked out of stock",
                          )
                        }
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        void run(
                          supabase.from("products").delete().eq("id", p.id),
                          "admin-store-products",
                          "Product removed",
                        )
                      }
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Current price {inr(Number(p.price))}</p>
                </AdminCard>
              ))}
              {!products?.length ? (
                <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No products for this store yet.
                </p>
              ) : null}
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}