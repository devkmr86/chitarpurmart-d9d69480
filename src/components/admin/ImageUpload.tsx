import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAdminImage } from "@/lib/admin-upload";
import { cn } from "@/lib/utils";

export function ImageUpload({
  value,
  onChange,
  folder,
  label = "Upload image",
  className,
}: {
  value?: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: string;
  label?: string;
  className?: string | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAdminImage(file, folder);
      onChange(url);
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
        {value ? (
          <img src={value} alt="Uploaded preview" className="size-full object-cover" loading="lazy" />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
          {value ? "Replace" : label}
        </Button>
        {value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            <X className="size-4" /> Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        ₹
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}