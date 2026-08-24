import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Star,
  Zap,
  ShieldCheck,
  Timer,
  ShoppingCart,
  ChevronRight,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { LocationSwitcher } from "@/components/app/LocationSwitcher";
import { useDeliveryArea } from "@/hooks/useDeliveryArea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { distanceKm, inr } from "@/lib/mannu";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mannu A2Z Mart — Food & Grocery Delivery in Minutes" },
      {
        name: "description",
        content:
          "Order food from nearby restaurants and grocery, sabji, meat, fruits & daily needs from trusted local stores. Live tracking, COD and fast hyperlocal delivery.",
      },
      { property: "og:title", content: "Mannu A2Z Mart — Food & Mart Delivery" },
      {
        property: "og:description",
        content: "Food aur Mart, dono ek hi app me. Aapke mohalle se minutes mein.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const EMOJI: Record<string, string> = {
  Ration: "🌾",
  "Kirana stores": "🛒",
  Grocery: "🛒",
  Sabji: "🥕",
  Meat: "🍗",
  Fruits: "🍎",
  Kapda: "👕",
  Jewellery: "💍",
  Kitchen: "🍳",
  Restaurant: "🍽️",
  Bakery: "🧁",
  Medicine: "💊",
  Beutiparlor: "💅",
};

const FOOD_WORDS = [
  "restaurant",
  "hotel",
  "dhaba",
  "bakery",
  "cafe",
  "food",
  "tiffin",
  "sweet",
  "mithai",
  "juice",
  "pizza",
  "biryani",
  "chinese",
  "momo",
  "fast",
];

const isFoodName = (name?: string | null) =>
  !!name && FOOD_WORDS.some((w) => name.toLowerCase().includes(w));

type Mode = "food" | "mart";

const FOOD_QUICK = ["Biryani", "Momos", "Pizza", "Thali", "Chowmein", "Cake", "Rolls", "Dosa"];
const MART_QUICK = ["Atta", "Doodh", "Sabji", "Chicken", "Tel", "Chawal", "Snacks", "Sabun"];

function Home() {
  const { user } = useAuth();
  const { area } = useDeliveryArea();
  const { count, subtotal } = useCart();
  const [mode, setMode] = useState<Mode>("mart");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const list = mode === "food" ? FOOD_QUICK : MART_QUICK;
    const t = setInterval(() => setPh((i) => (i + 1) % list.length), 2200);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => setCat(null), [mode]);

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

  const { data: banners } = useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("banners")
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
        .select("*, categories(name), shop_types(name)")
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

  const storeKind = (s: Record<string, unknown>): Mode => {
    const shop = (s["shop_types"] as { name: string } | null)?.name;
    const catName = (s["categories"] as { name: string } | null)?.name;
    return isFoodName(shop) || isFoodName(catName) ? "food" : "mart";
  };

  const modeCategories = useMemo(() => {
    const list = categories ?? [];
    return list.filter((c) => (mode === "food" ? isFoodName(c.name) : !isFoodName(c.name)));
  }, [categories, mode]);

  const nearby = useMemo(() => {
    let list = (stores ?? []).filter((s) => storeKind(s) === mode);
    if (cat) list = list.filter((s) => s.category_id === cat);
    if (q.trim().length > 1)
      list = list.filter((s) => s.store_name.toLowerCase().includes(q.trim().toLowerCase()));
    return list
      .map((s) => ({ ...s, km: distanceKm(area.lat, area.lng, s.latitude, s.longitude) }))
      .filter((s) => s.km <= 12)
      .sort((a, b) => a.km - b.km);
  }, [stores, cat, q, area.lat, area.lng, mode]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof nearby>();
    for (const s of nearby) {
      const key = (s.categories as { name: string } | null)?.name ?? "Aur bhi";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [nearby]);

  const eta = (km: number) => `${Math.max(10, Math.round(km * 4 + 8))} min`;
  const food = mode === "food";

  return (
    <AppShell>
      {/* ===== Swiggy-style header ===== */}
      <header
        className={cn(
          "sticky top-0 z-30 px-4 pb-3 pt-3 text-primary-foreground transition-colors",
          food
            ? "bg-gradient-to-br from-[oklch(0.66_0.2_38)] to-[oklch(0.55_0.21_25)]"
            : "bg-gradient-to-br from-primary to-[oklch(0.55_0.16_150)]",
        )}
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <LocationSwitcher className="min-w-0 text-left" />
            {user ? null : (
              <Link
                to="/auth"
                className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* dual toggle */}
          <div className="mt-3 flex rounded-full bg-black/20 p-1 backdrop-blur">
            {(["food", "mart"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-full py-2 text-sm font-bold transition-all",
                  mode === m ? "bg-card text-foreground shadow" : "text-white/85",
                )}
              >
                {m === "food" ? "🍽️ Food" : "🛒 Mannu Mart"}
              </button>
            ))}
          </div>

          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search "${(food ? FOOD_QUICK : MART_QUICK)[ph]}"`}
              className="h-11 rounded-2xl border-0 bg-card pl-9 text-foreground shadow-lg"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
          {[
            { icon: Timer, label: food ? "Hot & fresh" : "Fast delivery" },
            { icon: ShieldCheck, label: "Verified stores" },
            { icon: Zap, label: "Live tracking" },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-1 text-center">
              <f.icon className="size-4 text-accent" />
              <span className="text-[11px] font-medium text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>

        {/* banner rail */}
        {(banners?.length ?? 0) > 0 ? (
          <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {banners?.map((b) => (
              <div
                key={b.id}
                className="relative h-32 w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl bg-secondary"
              >
                {b.image_url ? (
                  <img
                    src={b.image_url}
                    alt={b.title}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                  <p className="font-display text-sm font-bold">{b.title}</p>
                  {b.subtitle ? <p className="text-[11px] opacity-90">{b.subtitle}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* what's on your mind — circular rail (Swiggy) */}
        <section className="mt-6">
          <h2 className="font-display text-base font-bold">
            {food ? "What's on your mind?" : "Shop by category"}
          </h2>
          <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {modeCategories.map((c) => {
              const active = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(active ? null : c.id)}
                  className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "grid size-16 place-items-center rounded-full text-2xl ring-2 transition",
                      active ? "bg-primary/10 ring-primary" : "bg-secondary ring-transparent",
                    )}
                  >
                    {EMOJI[c.name] ?? "🛍️"}
                  </span>
                  <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight">
                    {c.name}
                  </span>
                </button>
              );
            })}
            {modeCategories.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {food ? "Food categories jaldi aa rahi hain." : "Categories load ho rahi hain."}
              </p>
            ) : null}
          </div>
        </section>

        {/* product search results */}
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

        {/* top rated horizontal rail */}
        {nearby.length > 1 ? (
          <section className="mt-6">
            <h2 className="font-display text-base font-bold">
              {food ? "Top restaurants near you" : "Top shops near you"}
            </h2>
            <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {[...nearby]
                .sort((a, b) => Number(b.rating) - Number(a.rating))
                .slice(0, 8)
                .map((s) => (
                  <Link
                    key={s.id}
                    to="/store/$storeId"
                    params={{ storeId: s.id }}
                    className="w-40 shrink-0"
                  >
                    <div className="relative grid h-28 place-items-center overflow-hidden rounded-2xl bg-secondary text-4xl">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.store_name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        (EMOJI[(s.categories as { name: string } | null)?.name ?? ""] ?? "🏪")
                      )}
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {eta(s.km)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold">{s.store_name}</p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" />
                      {Number(s.rating).toFixed(1)} · {s.km} km
                    </p>
                  </Link>
                ))}
            </div>
          </section>
        ) : null}

        {/* grouped listing */}
        <section className="mt-6">
          <h2 className="font-display text-base font-bold">
            {cat
              ? "Selected category"
              : food
                ? "All restaurants near you"
                : "All shops near you"}
          </h2>

          {grouped.map(([group, list]) => (
            <div key={group} className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {EMOJI[group] ?? "🏪"} {group}
                </p>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <div className="mt-2 space-y-3">
                {list.map((s) => (
                  <Link
                    key={s.id}
                    to="/store/$storeId"
                    params={{ storeId: s.id }}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary text-2xl">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.store_name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        (EMOJI[(s.categories as { name: string } | null)?.name ?? ""] ?? "🏪")
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.store_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.address_line}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Star className="size-3 fill-warning text-warning" />
                          {Number(s.rating).toFixed(1)}
                        </Badge>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          {eta(s.km)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{s.km} km</span>
                        {s.store_status !== "open" ? (
                          <Badge variant="outline" className="text-[10px]">
                            Abhi band
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {nearby.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {area.name} ke 12 km ke andar koi {food ? "restaurant" : "shop"} nahi mila. Doosra
              area chunein ya {food ? "Mannu Mart" : "Food"} tab dekhein.
            </p>
          ) : null}
        </section>
      </main>

      {/* floating cart bar */}
      {count > 0 ? (
        <Link
          to="/cart"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-4" />
            {count} item{count > 1 ? "s" : ""} · {inr(subtotal)}
          </span>
          <span className="text-sm font-bold">View cart →</span>
        </Link>
      ) : null}
    </AppShell>
  );
}
