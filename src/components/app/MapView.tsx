import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";

export type MapMarker = {
  lat: number;
  lng: number;
  label?: string | undefined;
  kind?: "store" | "home" | "rider" | undefined;
  draggable?: boolean | undefined;
  onDragEnd?: ((lat: number, lng: number) => void) | undefined;
};

export type MapViewProps = {
  center: { lat: number; lng: number };
  zoom?: number | undefined;
  markers?: MapMarker[] | undefined;
  path?: Array<[number, number]> | undefined;
  className?: string | undefined;
  onMapClick?: ((lat: number, lng: number) => void) | undefined;
};

const EMOJI: Record<string, string> = { store: "🏪", home: "🏠", rider: "🛵" };
const RING: Record<string, string> = {
  store: "#16a34a",
  home: "#f97316",
  rider: "#2563eb",
};

function icon(kind: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:999px;background:#fff;border:2px solid ${
      RING[kind] ?? "#f97316"
    };box-shadow:0 4px 10px rgba(0,0,0,.2);font-size:17px">${EMOJI[kind] ?? "📍"}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function Recenter({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, zoom, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onMapClick) return;
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, onMapClick]);
  return null;
}

export default function MapView({
  center,
  zoom = 14,
  markers = [],
  path,
  className,
  onMapClick,
}: MapViewProps) {
  const icons = useMemo(
    () => Object.fromEntries(["store", "home", "rider", "pin"].map((k) => [k, icon(k)])),
    [],
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={className ?? "h-64 w-full"}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={center.lat} lng={center.lng} zoom={zoom} />
      <ClickHandler onMapClick={onMapClick} />
      {path && path.length > 1 ? (
        <Polyline positions={path} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.85 }} />
      ) : null}
      {markers.map((m, i) => (
        <Marker
          key={i}
          position={[m.lat, m.lng]}
          icon={icons[m.kind ?? "pin"]}
          draggable={!!m.draggable}
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              m.onDragEnd?.(p.lat, p.lng);
            },
          }}
        >
          {m.label ? <Popup>{m.label}</Popup> : null}
        </Marker>
      ))}
    </MapContainer>
  );
}
