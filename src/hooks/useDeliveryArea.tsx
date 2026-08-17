import { useCallback, useEffect, useState } from "react";

export type Area = { id: string; name: string; lat: number; lng: number };

export const AREAS: Area[] = [
  { id: "ranchi", name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  { id: "chitarpur", name: "Chitarpur", lat: 23.8083, lng: 85.6389 },
  { id: "gola", name: "Gola", lat: 23.4833, lng: 85.6667 },
  { id: "ramgarh", name: "Ramgarh", lat: 23.6307, lng: 85.514 },
];

const KEY = "mannu-area";
const EVENT = "mannu-area-change";

export type SelectedArea = { name: string; lat: number; lng: number; gps: boolean };

const DEFAULT_AREA: SelectedArea = {
  name: AREAS[0]!.name,
  lat: AREAS[0]!.lat,
  lng: AREAS[0]!.lng,
  gps: false,
};

function read(): SelectedArea {
  if (typeof window === "undefined") return DEFAULT_AREA;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_AREA, ...(JSON.parse(raw) as SelectedArea) } : DEFAULT_AREA;
  } catch {
    return DEFAULT_AREA;
  }
}

/** Zomato-style delivery area selector shared across the app (GPS or manual area). */
export function useDeliveryArea() {
  const [area, setAreaState] = useState<SelectedArea>(DEFAULT_AREA);

  useEffect(() => {
    setAreaState(read());
    const sync = () => setAreaState(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setArea = useCallback((next: SelectedArea) => {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { area, setArea };
}