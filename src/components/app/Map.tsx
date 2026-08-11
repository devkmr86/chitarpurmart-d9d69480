import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { MapViewProps } from "./MapView";

const MapView = lazy(() => import("./MapView"));

function Skeleton({ className }: { className?: string | undefined }) {
  return (
    <div
      className={`${className ?? "h-64 w-full"} animate-pulse rounded-[var(--radius)] bg-muted`}
    />
  );
}

export function Map(props: MapViewProps) {
  return (
    <ClientOnly fallback={<Skeleton className={props.className} />}>
      <Suspense fallback={<Skeleton className={props.className} />}>
        <MapView {...props} />
      </Suspense>
    </ClientOnly>
  );
}
