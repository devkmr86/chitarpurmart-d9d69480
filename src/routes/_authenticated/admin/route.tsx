import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGate,
});

function AdminGate() {
  const { roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!roles.includes("ADMIN")) {
    return (
      <AdminLayout title="Super Admin Portal">
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Admins only. You do not have access to this area.
        </p>
      </AdminLayout>
    );
  }

  return <Outlet />;
}