import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { useCart, lineKey } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — Mannu A2Z Mart" },
      { name: "description", content: "Review the items in your Mannu A2Z Mart cart before checkout." },
      { property: "og:title", content: "Your cart — Mannu A2Z Mart" },
      { property: "og:description", content: "Review items and place your hyperlocal order." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageHeader title="Your cart" subtitle={cart.storeName ?? "No items yet"} />
      <main className="mx-auto max-w-3xl px-4 py-4">
        {cart.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <ShoppingBag className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">Your cart is empty</p>
            <p className="text-sm text-muted-foreground">Add items from a nearby store.</p>
            <Button asChild className="mt-4">
              <Link to="/">Start shopping</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {cart.items.map((i) => (
                <div
                  key={lineKey(i)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-lg">
                    🧺
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.variantLabel ?? i.unitLabel}</p>
                    <p className="font-display font-bold text-primary">{inr(i.price * i.qty)}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-primary px-1">
                    <button
                      className="grid size-7 place-items-center text-primary"
                      onClick={() => cart.setQty(lineKey(i), i.qty - 1)}
                      aria-label="Decrease"
                    >
                      {i.qty === 1 ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
                    </button>
                    <span className="w-4 text-center text-sm font-bold">{i.qty}</span>
                    <button
                      className="grid size-7 place-items-center text-primary"
                      onClick={() => cart.setQty(lineKey(i), i.qty + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item total</span>
                <span className="font-semibold">{inr(cart.subtotal)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery charge and fees are calculated at checkout based on distance.
              </p>
            </div>

            <Button
              className="mt-4 h-12 w-full text-base"
              onClick={() =>
                navigate(
                  user
                    ? { to: "/checkout" }
                    : { to: "/auth", search: { next: "/checkout" } },
                )
              }
            >
              {user ? "Proceed to checkout" : "Login to continue"} · {inr(cart.subtotal)}
            </Button>
            <button
              className="mt-3 w-full text-center text-xs text-muted-foreground underline"
              onClick={cart.clear}
            >
              Clear cart
            </button>
          </>
        )}
      </main>
    </AppShell>
  );
}
