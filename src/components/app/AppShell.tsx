import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ClipboardList, ShoppingCart, User, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

type Tab = { to: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/cart", label: "Cart", icon: ShoppingCart },
  { to: "/profile", label: "Account", icon: User },
];

export function AppShell({
  children,
  hideNav,
}: {
  children: ReactNode;
  hideNav?: boolean;
}) {
  const { count } = useCart();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background pb-24">
      {children}
      {hideNav ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {TABS.map((t) => {
              const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <t.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                  {t.label}
                  {t.to === "/cart" && count > 0 ? (
                    <span className="absolute right-[22%] top-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string | undefined;
  right?: ReactNode | undefined;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold">{title}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}
