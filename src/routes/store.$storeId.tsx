import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCart, type CartItem } from "@/hooks/useCart";
import { inr } from "@/lib/mannu";
import { Map } from "@/components/app/Map";
import { BrandFooter } from "@/components/app/Tagline";

export const Route = createFileRoute("/store/$storeId")({
  head: () => ({
    meta: [
      { title: "Store — Mannu A2Z Mart" },
      { name: "description", content: "Browse products from this local Ranchi store and order online." },
      { property: "og:title", content: "Store — Mannu A2Z Mart" },
      { property: "og:description", content: "Fresh stock from your neighbourhood shop." },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const cart = useCart();
  const [pending, setPending] = useState<Omit<CartItem, "qty"> | null>(null);

  const { data: store } = useQuery({
    queryKey: ["store", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("*, categories(name)")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, units(short_name)")
        .eq("store_id", storeId)
        .order("product_name");
      return data ?? [];
    },
  });

  function qtyOf(id: string) {
    return cart.items.find((i) => i.productId === id)?.qty ?? 0;
  }

  function addItem(p: NonNullable<typeof products>[number]) {
    if (!store) return;
    const item: Omit<CartItem, "qty"> = {
      productId: p.id,
      name: p.product_name,
      price: Number(p.price),
      unitLabel: `${p.unit_qty} ${(p.units as { short_name?: string } | null)?.short_name ?? ""}`.trim(),
      storeId: store.id,
      storeName: store.store_name,
      imageUrl: p.image_url,
    };
    const res = cart.add(item);
    if (!res.ok) setPending(item);
  }

  return (
    <AppShell>
      <div className="relative h-36 bg-gradient-to-br from-accent to-[oklch(0.55_0.13_140)]">
        <Link
          to="/"
          className="absolute left-3 top-3 grid size-9 place-items-center rounded-full bg-card/90 shadow"
        >
          <ArrowLeft className="size-4" />
        </Link>
      </div>

      <main className="mx-auto -mt-10 max-w-3xl px-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <h1 className="font-display text-xl font-extrabold">{store?.store_name ?? "Store"}</h1>
          <p className="text-sm text-muted-foreground">{store?.address_line}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3 fill-warning text-warning" />
              {Number(store?.rating ?? 4).toFixed(1)}
            </Badge>
            <Badge variant="outline">
              {(store?.categories as { name: string } | null)?.name ?? "Store"}
            </Badge>
            {store?.is_active ? null : <Badge variant="destructive">Closed</Badge>}
          </div>
        </div>

        {store ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border">
            <Map
              center={{ lat: store.latitude, lng: store.longitude }}
              markers={[
                {
                  lat: store.latitude,
                  lng: store.longitude,
                  kind: "store",
                  label: store.store_name,
                },
              ]}
              className="h-40 w-full"
            />
          </div>
        ) : null}

        <section className="mt-5 space-y-3">
          <h2 className="font-display text-base font-bold">Products</h2>
          {(products ?? []).map((p) => {
            const qty = qtyOf(p.id);
            const soldOut = !p.is_available || Number(p.stock_qty) <= 0;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
                  🧺
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.product_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.unit_qty} {(p.units as { short_name?: string } | null)?.short_name}
                  </p>
                  <p className="mt-0.5 font-display font-bold text-primary">
                    {inr(p.price)}
                    {p.mrp ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                        {inr(p.mrp)}
                      </span>
                    ) : null}
                  </p>
                </div>
                {soldOut ? (
                  <Badge variant="destructive">Out of stock</Badge>
                ) : qty === 0 ? (
                  <Button size="sm" onClick={() => addItem(p)}>
                    Add
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-primary px-1">
                    <button
                      className="grid size-7 place-items-center text-primary"
                      onClick={() => cart.setQty(p.id, qty - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{qty}</span>
                    <button
                      className="grid size-7 place-items-center text-primary"
                      onClick={() => cart.setQty(p.id, qty + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 text-center">
          {store?.is_verified ? (
            <Badge variant="secondary" className="mb-1">Verified store</Badge>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {store?.fssai_number
              ? `License No. ${store.fssai_number}`
              : "FSSAI license number not provided by this store."}
          </p>
        </section>
        <BrandFooter />
      </main>

      {cart.count > 0 ? (
        <button
          onClick={() => navigate({ to: "/cart" })}
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-3xl items-center justify-between rounded-2xl bg-accent px-4 py-3 text-accent-foreground shadow-xl"
        >
          <span className="text-sm font-semibold">
            {cart.count} item{cart.count > 1 ? "s" : ""} · {inr(cart.subtotal)}
          </span>
          <span className="font-display font-bold">View cart →</span>
        </button>
      ) : null}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart already has items from <b>{cart.storeName}</b>. One order can only be
              placed from one store. Clear the cart and add this item instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep old cart</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) cart.replaceWith(pending);
                setPending(null);
                toast.success("New cart started");
              }}
            >
              Clear & add
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
