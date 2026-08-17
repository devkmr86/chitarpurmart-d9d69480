import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { uploadAdminImage } from "@/lib/admin-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type BankDetails = {
  account_holder?: string;
  bank_name?: string;
  account_number?: string;
  ifsc?: string;
};

/** Beneficiary settings for a seller store or a delivery partner. */
export function PayoutDetails({
  table,
  matchColumn,
  matchValue,
  onSaved,
  current,
}: {
  table: "stores" | "delivery_profiles";
  matchColumn: "id" | "user_id";
  matchValue: string;
  onSaved?: () => void;
  current?: {
    payout_upi_id?: string | null;
    payout_qr_url?: string | null;
    bank_details?: unknown;
  } | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [upi, setUpi] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [bank, setBank] = useState<BankDetails>({});

  useEffect(() => {
    if (!current) return;
    setUpi(current.payout_upi_id ?? "");
    setQr(current.payout_qr_url ?? null);
    setBank((current.bank_details as BankDetails) ?? {});
  }, [current]);

  async function pickQr(file: File) {
    try {
      setSaving(true);
      setQr(await uploadAdminImage(file, "payout"));
      toast.success("QR upload ho gaya");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fail");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update({
        payout_upi_id: upi.trim() || null,
        payout_qr_url: qr,
        bank_details: bank as never,
      })
      .eq(matchColumn, matchValue);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment details save ho gayi");
    setOpen(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Banknote className="size-4" /> Payment details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aapke paise kahan bhejein?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="rounded-xl bg-secondary p-3 text-xs">
            Aapka payment har raat admin dwara sidhe aapke UPI/Bank me bhej diya jayega. Alag se
            withdrawal request ki zarurat nahi hai.
          </p>
          <div>
            <Label className="text-xs">UPI ID</Label>
            <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" />
          </div>
          <div>
            <Label className="text-xs">QR code image</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickQr(f);
              }}
            />
            {qr ? (
              <img src={qr} alt="Payout QR" className="mt-2 size-32 rounded-lg object-contain" />
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["account_holder", "Account holder"],
                ["bank_name", "Bank name"],
                ["account_number", "Account number"],
                ["ifsc", "IFSC"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input
                  value={bank[k] ?? ""}
                  onChange={(e) => setBank((b) => ({ ...b, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save karein"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}