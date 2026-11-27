import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Share2,
} from "lucide-react";
import { api } from "../api";
import { useSession } from "../session";
import { initials, orgTypeLabel } from "../lib";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/bookings", label: "Bookings", icon: Handshake },
  { href: "/impact", label: "Impact", icon: BarChart3 },
  { href: "/organisation", label: "Organisation", icon: Building2 },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[4]];

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#D5F2B4" />
        <path
          d="M9 22.5V9.5h13M9 16h10.5M9 22.5h13"
          stroke="#123E35"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      {!compact ? (
        <span
          className={cn(
            "font-display text-[19px] font-extrabold tracking-tight",
            dark ? "text-forest" : "text-cream",
          )}
        >
          Oeuvre
        </span>
      ) : null}
    </span>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <span
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-cream/10 font-semibold text-cream"
                  : "text-cream/70 hover:bg-cream/[0.06] hover:text-cream",
              )}
            >
              <item.icon className={cn("h-[18px] w-[18px]", active ? "text-lime" : "text-cream/60")} />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
  });
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/oeuvre/notifications"],
    queryFn: () =>
      api.get<{
        notifications: {
          id: number;
          title: string;
          message: string;
          isRead: boolean;
          createdAt: string;
        }[];
        unread: number;
      }>("/notifications"),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: () => api.post("/notifications/read"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/notifications"] }),
  });

  const unread = data?.unread ?? 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && unread > 0) markRead.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-white text-forest transition-colors hover:bg-cream"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-forest px-1 text-[10px] font-bold text-lime">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="font-display text-sm font-semibold text-forest">Notifications</p>
          <p className="text-xs text-muted-foreground">Booking requests and updates</p>
        </div>
        <div className="scroll-slim max-h-80 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : data?.notifications.length ? (
            data.notifications.map((notification) => (
              <div key={notification.id} className="border-b border-border/60 px-4 py-3 last:border-0">
                <p className="text-sm font-medium text-forest">{notification.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {notification.message}
                </p>
              </div>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing yet. Booking activity will appear here.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { organisation, user } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-[#F7F7F2]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col bg-forest px-4 pb-4 pt-6 lg:flex">
        <Link href="/dashboard" className="px-2">
          <Logo />
        </Link>
        <p className="mt-2 px-2 text-[11px] leading-relaxed text-cream/50">
          Borrow what your community already owns.
        </p>

        <div className="mt-7 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/40">
            Workspace
          </p>
          <NavItems />
        </div>

        <div className="mt-4 rounded-xl border border-cream/10 bg-cream/[0.06] p-3">
          <div className="flex items-start gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime text-[12px] font-bold text-forest">
              {initials(organisation?.name ?? user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-cream">{organisation?.name}</p>
              <p className="truncate text-[11px] text-cream/55">
                {orgTypeLabel(organisation?.type)} · {organisation?.city}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-cream/15 py-1.5 text-[12px] font-medium text-cream/75 transition-colors hover:bg-cream/10 hover:text-cream disabled:opacity-60"
          >
            <LogOut className="h-3.5 w-3.5" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/80 bg-[#F7F7F2]/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation"
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-forest"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] border-0 bg-forest p-0">
                  <SheetTitle className="sr-only">Oeuvre navigation</SheetTitle>
                  <div className="flex h-full flex-col px-4 py-6">
                    <Logo />
                    <div className="mt-8 flex-1">
                      <NavItems onNavigate={() => setMobileOpen(false)} />
                    </div>
                    <button
                      type="button"
                      onClick={() => logout.mutate()}
                      className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-cream/15 py-2 text-sm text-cream/80"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <Link href="/dashboard" className="lg:hidden">
                <Logo dark />
              </Link>
            </div>

            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <Share2 className="h-4 w-4 text-moss" />
              <p className="truncate text-[13px] text-muted-foreground">
                <span className="font-medium text-forest">{organisation?.name}</span>
                <span className="mx-1.5">/</span>
                Equipment sharing workspace
              </p>
            </div>

            <div className="flex items-center gap-2">
              <NotificationsMenu />
              <Link href="/organisation">
                <span className="flex h-9 items-center gap-2 rounded-full border border-border bg-white pl-1 pr-3 transition-colors hover:bg-cream">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-[11px] font-bold text-lime">
                    {initials(user.name)}
                  </span>
                  <span className="hidden max-w-[130px] truncate text-[12px] font-medium text-forest sm:block">
                    {user.name}
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-14">
          <div className="rise">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const active =
              location === item.href || location.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                    active ? "text-forest" : "text-muted-foreground",
                  )}
                >
                  <item.icon className={cn("h-[18px] w-[18px]", active && "text-forest")} />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
