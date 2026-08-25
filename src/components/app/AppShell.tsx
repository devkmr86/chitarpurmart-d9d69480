import React from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ShoppingBag, Store, Bike, ShieldCheck, ChevronDown, User } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Super Admin Strict Check
  const isAdmin = user?.email === 'devkmr86@gmail.com' || profile?.role === 'admin';
  const isSeller = isAdmin || profile?.role === 'seller';
  const isDriver = isAdmin || profile?.role === 'driver';

  const currentPath = location.pathname;

  const getCurrentModeLabel = () => {
    if (currentPath.startsWith('/admin')) return { label: 'Admin Panel', icon: ShieldCheck, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    if (currentPath.startsWith('/seller')) return { label: 'Seller Mode', icon: Store, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    if (currentPath.startsWith('/delivery')) return { label: 'Delivery Duty', icon: Bike, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    return { label: 'Customer View', icon: ShoppingBag, color: 'text-blue-600 bg-blue-50 border-blue-200' };
  };

  const currentMode = getCurrentModeLabel();
  const ModeIcon = currentMode.icon;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Universal App Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm px-4 py-2.5 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer font-black text-xl tracking-tight text-blue-600"
          onClick={() => navigate({ to: '/' })}
        >
          <span>Mannu A2Z Mart</span>
        </div>

        {/* 1-Click Role Switcher */}
        <div className="flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={`h-8 px-2.5 text-xs font-semibold rounded-full border flex items-center gap-1.5 shadow-none ${currentMode.color}`}
                >
                  <ModeIcon className="w-3.5 h-3.5" />
                  <span>{currentMode.label}</span>
                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl shadow-lg border-slate-100">
                <DropdownMenuLabel className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 py-1">
                  Switch Working Role
                </DropdownMenuLabel>
                
                {/* Always visible to all */}
                <DropdownMenuItem 
                  onClick={() => navigate({ to: '/' })}
                  className="cursor-pointer text-xs font-medium py-2 rounded-lg gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-blue-500" />
                  <span>🛒 Customer Mode</span>
                </DropdownMenuItem>

                {/* Seller Mode - Strictly for store owners & Admin */}
                {isSeller && (
                  <DropdownMenuItem 
                    onClick={() => navigate({ to: '/seller' })}
                    className="cursor-pointer text-xs font-medium py-2 rounded-lg gap-2"
                  >
                    <Store className="w-4 h-4 text-amber-500" />
                    <span>🏪 Seller Dashboard</span>
                  </DropdownMenuItem>
                )}

                {/* Delivery Mode - Strictly for riders & Admin */}
                {isDriver && (
                  <DropdownMenuItem 
                    onClick={() => navigate({ to: '/delivery' })}
                    className="cursor-pointer text-xs font-medium py-2 rounded-lg gap-2"
                  >
                    <Bike className="w-4 h-4 text-emerald-500" />
                    <span>🛵 Delivery Duty</span>
                  </DropdownMenuItem>
                )}

                {/* Admin Mode - Strictly for devkmr86@gmail.com */}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="my-1 bg-slate-100" />
                    <DropdownMenuItem 
                      onClick={() => navigate({ to: '/admin' })}
                      className="cursor-pointer text-xs font-medium py-2 rounded-lg gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                      <span>👑 Admin Console</span>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem 
                  onClick={() => navigate({ to: '/profile' })}
                  className="cursor-pointer text-xs font-medium py-1.5 rounded-lg gap-2 text-slate-600"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>My Profile</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button 
              size="sm" 
              onClick={() => navigate({ to: '/auth' })}
              className="h-8 px-3 text-xs font-medium rounded-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Page Body */}
      <main className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
};
