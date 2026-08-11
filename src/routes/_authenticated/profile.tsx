import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Store, Bike, ShieldCheck, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Map } from "@/components/app/Map";
import { useAuth } from "@/hooks/useAuth";
import { RANCHI_CENTER } from "@/lib/mannu";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My account — Mannu A2Z Mart" },
      { name: "description", content: "Manage your Mannu A2Z Mart profile, roles and partner applications." },
      { property: "og:title", content: "My account — Mannu A2Z Mart" },
      { property: "og:description", content: "Become a seller or delivery partner on Mannu A2Z Mart." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { profile, roles, signOut } = useAuth();
  const isAdmin = roles.includes("ADMIN");
  const isSeller = roles.includes("SELLER");
  const isDelivery = roles.includes("DELIVERY");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["my-role-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("role_requests")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const pending = (role: string) =>
    (requests ?? []).some((r) => r.requested_role === role && r.status === "PENDING");

  return (
    <AppShell>
      <PageHeader title="My account" />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <div className="grid size-14 place-items-center rounded-full bg-primary text-xl text-primary-foreground">
            {(profile?.full_name ?? "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold">{profile?.full_name ?? "Customer"}</p>
            <p className="text-sm text-muted-foreground">{profile?.phone}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="text-[10px]">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          {isAdmin ? (
            <PanelLink to="/admin" icon={ShieldCheck} label="Admin panel" />
          ) : null}
          {isSeller ? <PanelLink to="/seller" icon={Store} label="Seller panel" /> : null}
          {isDelivery ? <PanelLink to="/delivery" icon={Bike} label="Delivery panel" /> : null}
        </section>

        {!isSeller ? (
          <ApplyDialog
            role="SELLER"
            disabled={pending("SELLER")}
            onDone={() => void qc.invalidateQueries({ queryKey: ["my-role-requests"] })}
          />
        ) : null}
        {!isDelivery ? (
          <ApplyDialog
            role="DELIVERY"
            disabled={pending("DELIVERY")}
            onDone={() => void qc.invalidateQueries({ queryKey: ["my-role-requests"] })}
          />
        ) : null}

        {(requests ?? []).length ? (
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-display font-bold">My applications</h2>
            <div className="mt-2 space-y-2">
              {requests?.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span>
                    {r.requested_role === "SELLER" ? r.store_name || "Seller" : "Delivery partner"}
                  </span>
                  <Badge
                    variant={
                      r.status === "APPROVED"
                        ? "secondary"
                        : r.status === "REJECTED"
                          ? "destructive"
                          : "default"
                    }
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </main>
    </AppShell>
  );
}

function PanelLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/admin" | "/seller" | "/delivery";
  icon: typeof Store;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 font-semibold"
    >
      <Icon className="size-5 text-primary" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </Link>
  );
}

function ApplyDialog({
  role,
  disabled,
  onDone,
}: {
  role: "SELLER" | "DELIVERY";
  disabled: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [address, setAddress] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [docType, setDocType] = useState("Aadhaar");
  const [docNumber, setDocNumber] = useState("");
  const [pos, setPos] = useState(RANCHI_CENTER);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name").order("sort_order");
      return data ?? [];
    },
  });

  async function submit() {
    if (role === "SELLER" && (!storeName.trim() || !categoryId || !address.trim())) {
      { toast.error("Fill store name, category and address"); return; }
    }
    if (role === "DELIVERY" && (!vehicle.trim() || !docNumber.trim())) {
      { toast.error("Fill vehicle number and ID document"); return; }
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("role_requests").insert({
      user_id: auth.user!.id,
      requested_role: role,
      store_name: role === "SELLER" ? storeName.trim() : null,
      category_id: role === "SELLER" ? categoryId : null,
      address_line: role === "SELLER" ? address.trim() : null,
      latitude: pos.lat,
      longitude: pos.lng,
      vehicle_number: role === "DELIVERY" ? vehicle.trim() : null,
      id_doc_type: role === "DELIVERY" ? docType : null,
      id_doc_number: role === "DELIVERY" ? docNumber.trim() : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Application submitted for admin approval");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start gap-3" disabled={disabled}>
          {role === "SELLER" ? <Store className="size-5" /> : <Bike className="size-5" />}
          {disabled
            ? `${role === "SELLER" ? "Seller" : "Delivery"} application pending`
            : `Become a ${role === "SELLER" ? "seller" : "delivery partner"}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {role === "SELLER" ? "Register your store" : "Delivery partner application"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {role === "SELLER" ? (
            <>
              <div className="space-y-1.5">
                <Label>Store name</Label>
                <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shop address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Vehicle number</Label>
                <Input
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value.toUpperCase())}
                  placeholder="JH01AB1234"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ID document</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Aadhaar", "Driving Licence", "Voter ID"].map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Document number</Label>
                <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Pin your location</Label>
            <div className="overflow-hidden rounded-xl border border-border">
              <Map
                center={pos}
                zoom={14}
                className="h-44 w-full"
                onMapClick={(lat, lng) => setPos({ lat, lng })}
                markers={[
                  {
                    lat: pos.lat,
                    lng: pos.lng,
                    kind: role === "SELLER" ? "store" : "rider",
                    draggable: true,
                    onDragEnd: (lat, lng) => setPos({ lat, lng }),
                  },
                ]}
              />
            </div>
          </div>

          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Submit for approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
