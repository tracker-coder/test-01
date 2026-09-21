import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useIsAdmin } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, ShoppingCart, Receipt, Banknote, Wallet, Package,
  BarChart3, FileText, Database, Users, Settings, LogOut, Menu, Coins, BookUser, History,
} from "lucide-react";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart },
  { to: "/sales", label: "Sales", icon: Receipt },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/expenses", label: "Expenses", icon: Coins },
  { to: "/banks", label: "Banks", icon: Banknote },
  { to: "/parties", label: "Party Statements", icon: BookUser },
  { to: "/cash-flow", label: "Cash Flow", icon: Wallet },

  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/master", label: "Master Data", icon: Database, adminOnly: true },
  { to: "/audit-log", label: "Audit Log", icon: History, adminOnly: true },
  { to: "/admin", label: "Users & Settings", icon: Users, adminOnly: true },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const isAdmin = useIsAdmin();
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((n) => {
        const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-display font-bold">
        G
      </div>
      <div className="leading-tight">
        <div className="font-display font-semibold text-sm">GUL Paper</div>
        <div className="text-[11px] text-muted-foreground">Management System</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <Brand />
        <div className="flex-1 overflow-y-auto py-2">
          <NavList />
        </div>
        <div className="border-t p-3">
          <div className="mb-2 px-2">
            <div className="text-xs font-medium truncate">{user?.email}</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {isAdmin ? "Admin" : "Staff"}
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-surface/80 backdrop-blur px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Brand />
                <NavList onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden">
              <div className="font-display font-semibold text-sm">GUL Paper</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin" className="hidden sm:inline-flex">
              {isAdmin && <Settings className="h-4 w-4 text-muted-foreground" />}
            </Link>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
