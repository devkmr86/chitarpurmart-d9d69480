import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, MapPin, Star, Zap, ShieldCheck, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mannu A2Z Mart — Ranchi Grocery & Daily Needs Delivery" },
      {
        name: "description",
        content:
          "Order ration, sabji, meat, fruits, kapda and kitchen items from trusted Ranchi stores. Live tracking, COD and fast hyperlocal delivery.",
      },
      { property: "og:title", content: "Mannu A2Z Mart — Ranchi Delivery" },
      {
        property: "og:description",
        content: "Your neighbourhood shops, delivered. Live order tracking across Ranchi.",
      },
    ],
  }),
  component: Home,
});

const EMOJI: Record<string, string> = {
  Ration: "🌾",
  Sabji: "🥕",
  Meat: "🍗",
  Fruits: "🍎",
  Kapda: "👕",
  Jewellery: "💍",
  Kitchen: "🍳",
};

function Home() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("rating", { ascending: false });
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["search-products", q],
    enabled: q.trim().length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,product_name,price,image_url,store_id,stores(store_name)")
        .ilike("product_name", `%${q.trim()}%`)
        .eq("is_available", true)
        .limit(20);
      return data ?? [];
    },
  });

  const visibleStores = useMemo(() => {
    let list = stores ?? [];
    if (cat) list = list.filter((s) => s.category_id === cat);
    if (q.trim().length > 1)
      list = list.filter((s) => s.store_name.toLowerCase().includes(q.trim().toLowerCase()));
    return list;
  }, [stores, cat, q]);

  return (
    <AppShell>
      <header className="rounded-b-3xl bg-gradient-to-br from-primary to-[oklch(0.62_0.19_35)] px-4 pb-6 pt-5 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1 text-xs/5 opacity-90">
                <MapPin className="size-3.5" /> Delivering to
              </p>
              <p className="font-display text-lg font-bold">Ranchi, Jharkhand</p>
            </div>
            {user ? null : (
              <Link
                to="/auth"
                className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur"
              >
                Sign in
              </Link>
            )}
          </div>

          <h1 className="mt-4 font-display text-2xl font-extrabold leading-tight">
            Mannu A2Z Mart
          </h1>
          <p className="text-sm opacity-90">Sab kuch, aapke mohalle se — minutes mein.</p>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search atta, sabji, chicken, kurta…"
              className="h-12 rounded-2xl border-0 bg-card pl-9 text-foreground shadow-lg"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <div className="-mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
          {[
            { icon: Timer, label: "Fast delivery" },
            { icon: ShieldCheck, label: "Verified stores" },
            { icon: Zap, label: "Live tracking" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1 text-center">
              <f.icon className="size-4 text-accent" />
              <span className="text-[11px] font-medium text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <h2 className="font-display text-base font-bold">Shop by category</h2>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {(categories ?? []).map((c) => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(active ? null : c.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="text-2xl">{EMOJI[c.name] ?? "🛍️"}</span>
                  <span className="text-[11px] font-semibold">{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {q.trim().length > 1 && (products?.length ?? 0) > 0 ? (
          <section className="mt-6">
            <h2 className="font-display text-base font-bold">Products</h2>
            <div className="mt-3 space-y-2">
              {products?.map((p) => (
                <Link
                  key={p.id}
                  to="/store/$storeId"
                  params={{ storeId: p.store_id }}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.product_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {(p.stores as { store_name: string } | null)?.store_name}
                    </p>
                  </div>
                  <span className="font-display font-bold text-primary">{inr(p.price)}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          <h2 className="font-display text-base font-bold">
            {cat ? "Stores in this category" : "Stores near you"}
          </h2>
          <div className="mt-3 space-y-3">
            {visibleStores.map((s) => (
              <Link
                key={s.id}
                to="/store/$storeId"
                params={{ storeId: s.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/50 hover:shadow-md"
              >
                <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-2xl">
                  {EMOJI[(s.categories as { name: string } | null)?.name ?? ""] ?? "🏪"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.store_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.address_line}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Star className="size-3 fill-warning text-warning" />
                      {Number(s.rating).toFixed(1)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {(s.categories as { name: string } | null)?.name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {visibleStores.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No stores found. Try another category or search.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
