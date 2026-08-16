import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet as WalletIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { inr } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Mera Wallet — Mannu A2Z Mart" },
      { name: "description", content: "Check your Mannu A2Z Mart wallet balance, instant refunds and payment history." },
      { property: "og:title", content: "Mera Wallet — Mannu A2Z Mart" },
      { property: "og:description", content: "Instant refunds and wallet payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("wallets").select("balance").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: txns } = useQuery({
    queryKey: ["wallet-txns", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  return (
    <AppShell>
      <PageHeader title="Mera Wallet" subtitle="Refund aur payment ka hisaab" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <WalletIcon className="size-5" />
          <p className="mt-2 text-xs opacity-90">Available balance</p>
          <p className="font-display text-3xl font-bold">{inr(Number(wallet?.balance ?? 0))}</p>
          <p className="mt-1 text-[11px] opacity-90">
            Order cancel ya reject hone par paisa turant yahan wapas aata hai.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-display font-bold">History</h2>
          <div className="mt-2 space-y-2">
            {(txns ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.note ?? t.kind}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
                <Badge variant={Number(t.amount) >= 0 ? "secondary" : "outline"}>
                  {Number(t.amount) >= 0 ? "+" : "−"}
                  {inr(Math.abs(Number(t.amount)))}
                </Badge>
              </div>
            ))}
            {txns?.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Abhi koi transaction nahi hai.
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
