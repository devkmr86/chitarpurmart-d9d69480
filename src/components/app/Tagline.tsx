import { Link } from "@tanstack/react-router";
import { useBusiness } from "@/hooks/useBusiness";
import { cn } from "@/lib/utils";

/** Dynamic platform slogan, rendered under headers and drawers. */
export function Tagline({ className }: { className?: string | undefined }) {
  const { tagline } = useBusiness();
  return <p className={cn("text-[11px] font-medium text-muted-foreground", className)}>{tagline}</p>;
}

/** Legal footer with live FSSAI / Udyam details from admin settings. */
export function BrandFooter() {
  const { business, tagline, brand } = useBusiness();
  return (
    <footer className="mt-6 border-t border-border px-4 py-6 text-center">
      <p className="font-display text-sm font-bold">{brand}</p>
      <p className="text-[11px] text-muted-foreground">{tagline}</p>
      <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        {business?.fssai_number ? <p>FSSAI Lic. No. {business.fssai_number}</p> : null}
        {business?.udyam_number ? <p>Udyam Reg. No. {business.udyam_number}</p> : null}
        {business?.support_phone ? <p>Support: {business.support_phone}</p> : null}
      </div>
      <Link to="/about" className="mt-2 inline-block text-[11px] font-semibold text-primary">
        About us
      </Link>
    </footer>
  );
}
