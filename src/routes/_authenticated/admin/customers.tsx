import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { KeyRound, MessageCircle, Phone, Search, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminResetUserPassword } from "@/lib/mannu.functions";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout, AdminCard, StatCard } from "@/components/admin/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhone } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Mannu A2Z Mart Admin" },
      {
        name: "description",
        content: "Customer marketing repository with 1-click WhatsApp offer messages.",
      },
      { property: "og:title", content: "Customers — Mannu A2Z Mart Admin" },
      { property: "og:description", content: "Registered customers and WhatsApp offer campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

type Row = {
  id: string;
  phone: string;
  full_name: string;
  account_status: string;
  created_at: string;
};

const DEFAULT_OFFER =
  "Namaste! Mannu A2Z Mart par aaj special offer hai — ghar baithe grocery, food aur zaroorat ka saara saamaan order karein. Aapke ghar ki digital dukan!";

function CustomersPage() {
  const [q, setQ] = useState("");
  const [message, setMessage] = useState(DEFAULT_OFFER);

  const { data: customers } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,phone,full_name,account_status,created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const nonCustomer = new Set(
        (roles ?? [])
          .filter((r) => r.role !== "CUSTOMER")
          .map((r) => r.user_id),
      );
      return ((profiles ?? []) as Row[]).map((p) => ({
        ...p,
        isPartner: nonCustomer.has(p.id),
      }));
    },
  });

  const { data: orderCounts } = useQuery({
    queryKey: ["admin-customer-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("customer_id,total");
      const map = new Map<string, { orders: number; spend: number }>();
      for (const o of data ?? []) {
        const cur = map.get(o.customer_id) ?? { orders: 0, spend: 0 };
        cur.orders += 1;
        cur.spend += Number(o.total ?? 0);
        map.set(o.customer_id, cur);
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (customers ?? []).filter(
      (c) =>
        !needle ||
        c.full_name?.toLowerCase().includes(needle) ||
        c.phone?.includes(needle),
    );
  }, [customers, q]);

  const total = customers?.length ?? 0;
  const buyers = (customers ?? []).filter((c) => (orderCounts?.get(c.id)?.orders ?? 0) > 0).length;

  function waLink(phone: string) {
    const p = normalizePhone(phone);
    return `https://wa.me/91${p}?text=${encodeURIComponent(message)}`;
  }

  return (
    <AdminLayout title="Customers" subtitle="Marketing repository & WhatsApp offers">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total customers" value={String(total)} icon={Users} />
        <StatCard label="Ordered at least once" value={String(buyers)} icon={Users} />
        <StatCard
          label="Never ordered"
          value={String(Math.max(0, total - buyers))}
          hint="WhatsApp offer bhejne ke liye best"
          icon={Users}
        />
      </div>

      <PasswordResetRequests />

      <AdminCard className="mt-4">
        <p className="text-sm font-semibold">WhatsApp offer message</p>
        <Textarea
          className="mt-2"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Yeh text har customer ke WhatsApp chat me pre-filled aayega.
        </p>
      </AdminCard>

      <AdminCard className="mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Naam ya number se search karein"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((c) => {
            const stats = orderCounts?.get(c.id);
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {c.full_name || "Customer"}{" "}
                    {c.isPartner ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        partner
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone} · {stats?.orders ?? 0} orders · ₹
                    {Math.round(stats?.spend ?? 0).toLocaleString("en-IN")} spend
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <a href={`tel:${normalizePhone(c.phone)}`}>
                      <Phone className="size-4" /> Call
                    </a>
                  </Button>
                  <Button asChild size="sm" className="gap-1">
                    <a href={waLink(c.phone)} target="_blank" rel="noreferrer">
                      <MessageCircle className="size-4" /> WhatsApp offer
                    </a>
                  </Button>
                </div>
              </div>
            );
          })}
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Koi customer nahi mila.
            </p>
          ) : null}
        </div>
      </AdminCard>
    </AdminLayout>
  );
}

function PasswordResetRequests() {
  const qc = useQueryClient();
  const resetPassword = useServerFn(adminResetUserPassword);
  const [pw, setPw] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const { data: reqs } = useQuery({
    queryKey: ["admin-password-resets"],
    refetchInterval: 30000,
    queryFn: async () =>
      (
        await supabase
          .from("password_reset_requests")
          .select("id,phone,note,status,created_at")
          .eq("status", "PENDING")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function apply(id: string, phone: string) {
    const newPassword = (pw[id] ?? "").trim();
    if (newPassword.length < 6) {
      toast.error("Password kam se kam 6 characters ka ho");
      return;
    }
    setBusy(id);
    try {
      await resetPassword({ data: { requestId: id, newPassword } });
      toast.success(`Password set ho gaya — ${phone} ko bata dein`);
      setPw((p) => ({ ...p, [id]: "" }));
      void qc.invalidateQueries({ queryKey: ["admin-password-resets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  if (!reqs?.length) return null;

  return (
    <AdminCard className="mt-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4" /> Password reset requests ({reqs.length})
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {reqs.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
            <p className="font-display font-bold">{r.phone}</p>
            {r.note ? <p className="text-xs text-muted-foreground">{r.note}</p> : null}
            <div className="mt-2 flex gap-2">
              <Input
                value={pw[r.id] ?? ""}
                onChange={(e) => setPw((p) => ({ ...p, [r.id]: e.target.value }))}
                placeholder="Naya password (min 6)"
              />
              <Button
                size="sm"
                disabled={busy === r.id}
                onClick={() => void apply(r.id, r.phone)}
              >
                Set
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`https://wa.me/91${normalizePhone(r.phone)}?text=${encodeURIComponent(
                    `Namaste! Aapka Mannu A2Z Mart ka naya password: ${pw[r.id] ?? ""}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="size-4" />
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}
