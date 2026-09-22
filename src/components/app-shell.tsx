import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useIsAdmin } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard, ShoppingCart, Receipt, Banknote, Wallet, Package,
  BarChart3, FileText, Database, Users, Settings, LogOut, Menu, Coins,
  BookUser, History, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped so the 13 destinations read as four short lists rather than one long
 * one — day-to-day entry, then money, then reporting, then admin.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Daily entry",
    items: [
      { to: "/purchases", label: "Purchases", icon: ShoppingCart },
      { to: "/sales", label: "Sales", icon: Receipt },
      { to: "/inventory", label: "Inventory", icon: Package },
      { to: "/expenses", label: "Expenses", icon: Coins },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/banks", label: "Banks", icon: Banknote },
      { to: "/parties", label: "Party Statements", icon: BookUser },
      { to: "/cash-flow", label: "Cash Flow", icon: Wallet },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/reports", label: "Reports", icon: FileText },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/master", label: "Master Data", icon: Database, adminOnly: true },
      { to: "/audit-log", label: "Audit Log", icon: History, adminOnly: true },
      { to: "/admin", label: "Users & Settings", icon: Users, adminOnly: true },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const SIDEBAR_STORAGE_KEY = "gul-sidebar-collapsed";

function isActive(pathname: string, to: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

function useCurrentPage() {
  const location = useLocation();
  // Longest match wins so "/parties/123" still resolves to Party Statements.
  return ALL_ITEMS.filter((i) => isActive(location.pathname, i.to)).sort(
    (a, b) => b.to.length - a.to.length,
  )[0];
}

function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const isAdmin = useIsAdmin();

  return (
    <nav className="flex flex-col gap-5 px-3" aria-label="Main">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((n) => !n.adminOnly || isAdmin);
        if (items.length === 0) return null;

        return (
          <div key={group.label} className="flex flex-col gap-1">
            {collapsed ? (
              <div className="mx-auto my-1 h-px w-6 bg-sidebar-border" aria-hidden />
            ) : (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </div>
            )}

            {items.map((n) => {
              const active = isActive(location.pathname, n.to);
              const Icon = n.icon;

              const link = (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? n.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg text-sm font-medium outline-none transition-colors",
                    collapsed ? "h-10 w-10 justify-center self-center" : "gap-3 px-3 py-2",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  {/* Left rail marker makes the current page obvious at a glance. */}
                  {active && !collapsed && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                      aria-hidden
                    />
                  )}
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                </Link>
              );

              if (!collapsed) return link;

              return (
                <Tooltip key={n.to} delayDuration={0}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{n.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-16 shrink-0 items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-2" : "gap-2.5 px-4",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-base font-bold text-primary-foreground shadow-sm">
        G
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold">GUL Paper</div>
          <div className="text-[11px] text-muted-foreground">Management System</div>
        </div>
      )}
    </div>
  );
}

function initialsFrom(email?: string | null) {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function UserMenu({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useSession();
  const isAdmin = useIsAdmin();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-1.5 sm:px-2"
          aria-label="Account menu"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
            {initialsFrom(user?.email)}
          </span>
          <span className="hidden max-w-[11rem] truncate text-sm font-medium lg:inline">
            {user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user?.email}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                isAdmin
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isAdmin ? "Admin" : "Staff"}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild className="gap-2">
            <Link to="/admin">
              <Settings className="h-4 w-4" />
              Users &amp; Settings
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onSignOut}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const current = useCurrentPage();

  // Read after mount so server and client render identical markup.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1");
    } catch {
      /* storage blocked — keep the sidebar expanded */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* non-fatal */
      }
      return next;
    });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
        >
          Skip to content
        </a>

        {/* ---------- Desktop sidebar ---------- */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
            collapsed ? "w-[4.5rem]" : "w-64",
          )}
        >
          <Brand collapsed={collapsed} />

          <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
            <NavList collapsed={collapsed} />
          </div>

          <div className="border-t border-sidebar-border p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "w-full gap-2 text-muted-foreground",
                collapsed ? "justify-center px-0" : "justify-start",
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-surface/85 px-4 backdrop-blur-md lg:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Brand />
                <div className="flex-1 overflow-y-auto py-4">
                  <NavList onNavigate={() => setOpen(false)} />
                </div>
                <div className="border-t border-sidebar-border p-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Current page name — the sidebar covers this on desktop. */}
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              {current?.icon && (
                <current.icon className="hidden h-[18px] w-[18px] shrink-0 text-muted-foreground sm:block" />
              )}
              <span className="truncate font-display text-[15px] font-semibold">
                {current?.label ?? "GUL Paper"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <UserMenu onSignOut={signOut} />
            </div>
          </header>

          <main
            id="main-content"
            className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 lg:p-6"
          >
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
