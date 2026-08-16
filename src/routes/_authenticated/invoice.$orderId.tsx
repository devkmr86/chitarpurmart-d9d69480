import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/hooks/useBusiness";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/invoice/$orderId")({
  head: () => ({
    meta: [
      { title: "Invoice — Mannu A2Z Mart" },
      { name: "description", content: "Download or print the tax invoice for your Mannu A2Z Mart order." },
      { property: "og:title", content: "Invoice — Mannu A2Z Mart" },
      { property: "og:description", content: "Order invoice with licence and registration details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invoice,
});

function Invoice() {
  const { orderId } = Route.useParams();
  const { business, brand, tagline } = useBusiness();

  const { data: order } = useQuery({
    queryKey: ["invoice", orderId],
    queryFn: async () =>
      (await supabase.from("orders").select("*").eq("id", orderId).maybeSingle()).data,
  });

  const { data: items } = useQuery({
    queryKey: ["invoice-items", orderId],
    queryFn: async () =>
      (
        await supabase
          .from("order_items")
          .select("*, stores(store_name, fssai_number)")
          .eq("order_id", orderId)
      ).data ?? [],
  });

  if (!order) {
    return <p className="p-10 text-center text-sm text-muted-foreground">Loading invoice…</p>;
  }

  const store = (items ?? []).map((i) => i.stores as { store_name?: string; fssai_number?: string | null } | null)[0];

  return (
    <div className="min-h-screen bg-muted/30 py-6 print:bg-white print:py-0">
      <div className="mx-auto max-w-2xl bg-card p-6 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-bold">{brand}</h1>
            <p className="text-xs text-muted-foreground">{tagline}</p>
            {business?.fssai_number ? (
              <p className="mt-1 text-[11px] text-muted-foreground">FSSAI: {business.fssai_number}</p>
            ) : null}
            {business?.udyam_number ? (
              <p className="text-[11px] text-muted-foreground">Udyam: {business.udyam_number}</p>
            ) : null}
          </div>
          <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}>
            <Printer className="mr-1 size-4" /> Download / Print
          </Button>
        </div>

        <div className="mt-5 grid gap-1 text-sm">
          <p className="font-display text-base font-bold">Invoice · {order.order_no}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(order.placed_at).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Deliver to: {order.delivery_address}</p>
          {store?.store_name ? (
            <p className="text-xs text-muted-foreground">
              Store: {store.store_name}
              {store.fssai_number ? ` · FSSAI ${store.fssai_number}` : ""}
            </p>
          ) : null}
        </div>

        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id} className="border-b border-border">
                <td className="py-2">
                  {i.product_name}
                  <span className="block text-[11px] text-muted-foreground">{i.unit_label}</span>
                </td>
                <td className="py-2 text-right">{i.qty}</td>
                <td className="py-2 text-right">{inr(Number(i.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 text-sm">
          <Line label="Subtotal" value={Number(order.subtotal)} />
          <Line label="Delivery" value={Number(order.delivery_charge)} />
          <Line label="Platform fee" value={Number(order.platform_fee)} />
          {Number(order.discount) > 0 ? <Line label="Discount" value={-Number(order.discount)} /> : null}
          <div className="flex items-center justify-between border-t border-border pt-2 font-display text-base font-bold">
            <span>Total ({order.payment_mode})</span>
            <span>{inr(Number(order.total))}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Thank you for shopping with {brand} — {tagline}
        </p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{inr(value)}</span>
    </div>
  );
}
