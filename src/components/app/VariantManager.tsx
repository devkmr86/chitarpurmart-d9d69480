import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Ruler } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/mannu";

export type VariantDraft = {
  label: string;
  unit_id: string;
  unit_qty: string;
  price: string;
  mrp: string;
  stock_qty: string;
};

export function emptyVariant(): VariantDraft {
  return { label: "", unit_id: "", unit_qty: "1", price: "", mrp: "", stock_qty: "10" };
}

/** Units list, optionally narrowed to the units a category allows. */
export function useUnits(allowed?: string[] | undefined) {
  const q = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id,short_name,name").eq("is_active", true);
      return data ?? [];
    },
  });
  const all = q.data ?? [];
  const filtered =
    allowed && allowed.length
      ? all.filter((u) => allowed.some((a) => a.toLowerCase() === u.short_name.toLowerCase()))
      : all;
  return { ...q, data: filtered.length ? filtered : all };
}

/** Rows used while creating a product — parent owns the state. */
export function VariantRepeater({
  rows,
  onChange,
  allowedUnits,
}: {
  rows: VariantDraft[];
  onChange: (rows: VariantDraft[]) => void;
  allowedUnits?: string[] | undefined;
}) {
  const { data: units } = useUnits(allowedUnits);

  function update(i: number, patch: Partial<VariantDraft>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="rounded-xl border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Size {i + 1}</span>
            {rows.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Size name (jaise 500 g / 1 kg)</Label>
              <Input value={r.label} onChange={(e) => update(i, { label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input inputMode="decimal" value={r.price} onChange={(e) => update(i, { price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input inputMode="decimal" value={r.mrp} onChange={(e) => update(i, { mrp: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pack qty</Label>
              <Input
                inputMode="decimal"
                value={r.unit_qty}
                onChange={(e) => update(i, { unit_qty: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input
                inputMode="numeric"
                value={r.stock_qty}
                onChange={(e) => update(i, { stock_qty: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Unit</Label>
              <Select value={r.unit_id} onValueChange={(v) => update(i, { unit_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="kg / g / pc / litre" />
                </SelectTrigger>
                <SelectContent>
                  {(units ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.short_name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full gap-2" onClick={() => onChange([...rows, emptyVariant()])}>
        <Plus className="size-4" /> Add Size
      </Button>
    </div>
  );
}

export function draftsToRows(productId: string, rows: VariantDraft[]) {
  return rows
    .filter((r) => r.label.trim() && r.price)
    .map((r, i) => ({
      product_id: productId,
      label: r.label.trim(),
      unit_id: r.unit_id || null,
      unit_qty: Number(r.unit_qty || 1),
      price: Number(r.price),
      mrp: r.mrp ? Number(r.mrp) : null,
      stock_qty: Number(r.stock_qty || 0),
      sort_order: i,
    }));
}

/** Manage sizes of an already-saved product. */
export function VariantManager({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<VariantDraft>(emptyVariant());
  const qc = useQueryClient();
  const { data: units } = useUnits();

  const { data: variants, isLoading } = useQuery({
    queryKey: ["product-variants", productId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      return data ?? [];
    },
  });

  async function add() {
    if (!draft.label.trim() || !draft.price) {
      toast.error("Size ka naam aur price daalein");
      return;
    }
    setSaving(true);
    const [row] = draftsToRows(productId, [draft]);
    const { error } = await supabase.from("product_variants").insert(row!);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft(emptyVariant());
    toast.success("Size add ho gaya");
    void qc.invalidateQueries({ queryKey: ["product-variants", productId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("product_variants").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["product-variants", productId] });
  }

  async function toggle(id: string, v: boolean) {
    await supabase.from("product_variants").update({ is_available: v }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["product-variants", productId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1">
          <Ruler className="size-4" /> Sizes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{productName} — sizes</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin" />
        ) : (
          <div className="space-y-2">
            {(variants ?? []).map((v) => (
              <div key={v.id} className="flex items-center gap-2 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{v.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {inr(Number(v.price))} · stock {v.stock_qty}
                  </p>
                </div>
                <Switch checked={v.is_available} onCheckedChange={(c) => void toggle(v.id, c)} />
                <Button size="icon" variant="ghost" onClick={() => void remove(v.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {(variants ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Abhi koi size nahi. Neeche se add karein.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-2 space-y-2 rounded-xl border border-border p-3">
          <div className="space-y-1.5">
            <Label>Size name</Label>
            <Input
              placeholder="500 g"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Price (₹)</Label>
              <Input
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>MRP (₹)</Label>
              <Input
                inputMode="decimal"
                value={draft.mrp}
                onChange={(e) => setDraft({ ...draft, mrp: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pack qty</Label>
              <Input
                inputMode="decimal"
                value={draft.unit_qty}
                onChange={(e) => setDraft({ ...draft, unit_qty: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stock</Label>
              <Input
                inputMode="numeric"
                value={draft.stock_qty}
                onChange={(e) => setDraft({ ...draft, stock_qty: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={draft.unit_id} onValueChange={(v) => setDraft({ ...draft, unit_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="kg / g / pc / litre" />
              </SelectTrigger>
              <SelectContent>
                {(units ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.short_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full gap-2" onClick={() => void add()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Add Size</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
