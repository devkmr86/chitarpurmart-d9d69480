export const AUTH_EMAIL_DOMAIN = "mannu.local";

export function phoneToEmail(phone: string) {
  return `${normalizePhone(phone)}@${AUTH_EMAIL_DOMAIN}`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

export function isValidPhone(phone: string) {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function inr(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Haversine distance in km */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(s))).toFixed(2);
}

export type DeliverySlab = { max_km: number; charge: number };

export function chargeForDistance(slabs: DeliverySlab[], km: number) {
  const sorted = [...slabs].sort((a, b) => a.max_km - b.max_km);
  for (const slab of sorted) if (km <= slab.max_km) return slab.charge;
  const last = sorted[sorted.length - 1];
  if (!last) return 0;
  const extra = Math.ceil(km - last.max_km);
  return last.charge + extra * 10;
}

export const RANCHI_CENTER = { lat: 23.3441, lng: 85.3096 };

export const ORDER_FLOW = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
  "DELIVERED",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  PLACED: "Order placed",
  ACCEPTED: "Accepted by store",
  PREPARING: "Being prepared",
  READY: "Ready for pickup",
  ASSIGNED: "Partner assigned",
  PICKED_UP: "Picked up",
  ON_THE_WAY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};
