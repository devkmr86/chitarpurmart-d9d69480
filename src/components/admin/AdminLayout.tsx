import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  UserCheck,
  Store,
  Bike,
  ClipboardList,
  Boxes,
  Wallet,
  Ticket,
  Settings,
  Landmark,
  Menu,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type NavItem = { to: string; label: string; icon: LucideIcon };

export const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard Analytics", icon: BarChart3 },
  { to: "/admin/approvals", label: "Approvals & Onboarding", icon: UserCheck },
  { to: "/admin/stores", label: "Stores Management", icon: Store },
  { to: "/admin/partners", label: "Delivery Partners", icon: Bike },
  { to: "/admin/orders", label: "Orders Master", icon: ClipboardList },
  { to: "/admin/catalog", label: "Catalog & Categories", icon: Boxes },
  { to: "/admin/payouts", label: "Payouts & Commission", icon: Wallet },
  { to: "/admin/promos", label: "Coupons & Banners", icon: Ticket },
  { to: "/admin/bank", label: "Bank & Settlement", icon: Landmark },
  { to: "/admin/settings", label: "System Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-2 py-4">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <ShieldCheck className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-bold leading-tight">Super Admin</p>
        <p className="truncate text-[11px] text-muted-foreground">Mannu A2Z Mart</p>
      </div>
    </div>
  );
}

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-card px-3 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto pb-4">
          <NavLinks />
        </div>
        <div className="border-t border-border py-3">
          <p className="px-3 pb-2 text-xs text-muted-foreground">{profile?.full_name || profile?.phone}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => void signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 px-3">
              <Brand />
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-bold">{title}</h1>
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
      </div>
    </div>
  );
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>{children}</div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon: LucideIcon;
}) {
  return (
    <AdminCard>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
    </AdminCard>
  );
}