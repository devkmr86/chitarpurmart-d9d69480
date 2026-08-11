import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inr, STATUS_LABEL } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "My orders — Mannu A2Z Mart" },
      { name: "description", content: "Track your current and past Mannu A2Z Mart orders." },
      { property: "og:title", content: "My orders — Mannu A2Z Mart" },
      { property: "og:description", content: "Live status of every order you placed." },
    ],
  }),
  component: Orders,
});

function Orders() {
  const { data: orders } = useQuery({
    queryKey: ["my-orders"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id,order_no,status,total,placed_at,delivery_address")
        .order("placed_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <PageHeader title="My orders" />
      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {(orders ?? []).map((o) => (
          <Link
            key={o.id}
            to="/order/$orderId"
            params={{ orderId: o.id }}
            className="block rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">{o.order_no}</span>
              <Badge variant={o.status === "DELIVERED" ? "secondary" : "default"}>
                {STATUS_LABEL[o.status] ?? o.status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{o.delivery_address}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {new Date(o.placed_at).toLocaleString("en-IN")}
              </span>
              <span className="font-bold text-primary">{inr(o.total)}</span>
            </div>
          </Link>
        ))}
        {orders?.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center">
            <ClipboardList className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No orders yet</p>
            <Button asChild className="mt-4">
              <Link to="/">Browse stores</Link>
            </Button>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
