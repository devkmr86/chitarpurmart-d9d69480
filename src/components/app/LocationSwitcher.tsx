import { useState } from "react";
import { ChevronDown, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AREAS, useDeliveryArea } from "@/hooks/useDeliveryArea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Top-bar "Deliver to: Area ▾" selector with GPS or manual area choice. */
export function LocationSwitcher({ className }: { className?: string }) {
  const { area, setArea } = useDeliveryArea();
  const [open, setOpen] = useState(false);

  function useGps() {
    if (!navigator.geolocation) {
      toast.error("Location support nahi hai");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setArea({
          name: "Meri current location",
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          gps: true,
        });
        setOpen(false);
      },
      () => toast.error("Location nahi mil payi"),
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={className}>
          <span className="flex items-center gap-1 text-xs/5 opacity-90">
            <MapPin className="size-3.5" /> Deliver to
          </span>
          <span className="flex items-center gap-1 font-display text-lg font-bold">
            {area.name} <ChevronDown className="size-4" />
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delivery area chunein</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start gap-2" onClick={useGps}>
            <LocateFixed className="size-4" /> Use current location (GPS)
          </Button>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Ya area select karein</p>
            {AREAS.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setArea({ name: a.name, lat: a.lat, lng: a.lng, gps: false });
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm ${
                  area.name === a.name ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <MapPin className="size-4 text-primary" /> {a.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Doosre sheher se bhi order kar sakte hain — stores aur delivery charge aapke chune hue
            area ke hisaab se dikhenge.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}