import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { api, ApiError, type MeResponse } from "./oeuvre/api";
import { SessionProvider } from "./oeuvre/session";
import { AppShell } from "./oeuvre/components/shell";
import LandingPage from "./oeuvre/pages/landing";
import AuthPage from "./oeuvre/pages/auth";
import OnboardingPage from "./oeuvre/pages/onboarding";
import DashboardPage from "./oeuvre/pages/dashboard";
import InventoryPage from "./oeuvre/pages/inventory";
import EquipmentDetailPage from "./oeuvre/pages/equipment-detail";
import EventsPage from "./oeuvre/pages/events";
import NewEventPage from "./oeuvre/pages/event-new";
import EventDetailPage from "./oeuvre/pages/event-detail";
import MatchesPage from "./oeuvre/pages/matches";
import BookingsPage from "./oeuvre/pages/bookings";
import OrganisationPage from "./oeuvre/pages/organisation";
import PublicOrganisationPage from "./oeuvre/pages/organisation-public";
import ImpactPage from "./oeuvre/pages/impact";

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#F7F7F2]">
      <div className="flex flex-col items-center gap-3">
        <div className="skeleton h-10 w-36" />
        <p className="text-[12px] text-muted-foreground">Loading your workspace…</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="surface mx-auto max-w-md px-6 py-12 text-center">
      <p className="font-display text-[22px] font-bold text-forest">Page not found</p>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        That page does not exist in this workspace.
      </p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-10 items-center rounded-lg bg-forest px-4 text-[13px] font-semibold text-cream"
      >
        Back to the dashboard
      </a>
    </div>
  );
}

function useSessionQuery() {
  return useQuery({
    queryKey: ["/api/oeuvre/auth/me"],
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
  });
}

function SignedOutRoutes() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/signup" component={AuthPage} />
      <Route path="/" component={LandingPage} />
      {/* Any other path shows the sign-in page. Redirecting to "/" here used
          to fire while a fresh login was still propagating, which pushed the
          just-navigated workspace URL back to the landing page. */}
      <Route component={AuthPage} />
    </Switch>
  );
}

function WorkspaceRoutes() {
  return (
    <AppShell>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/inventory" component={InventoryPage} />
        <Route path="/equipment/:id" component={EquipmentDetailPage} />
        <Route path="/events/new" component={NewEventPage} />
        <Route path="/events/:id/match" component={MatchesPage} />
        <Route path="/events/:id" component={EventDetailPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/bookings" component={BookingsPage} />
        <Route path="/impact" component={ImpactPage} />
        <Route path="/organisation" component={OrganisationPage} />
        <Route path="/organisations/:id" component={PublicOrganisationPage} />
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </AppShell>
  );
}

function Router() {
  const { data, isLoading } = useSessionQuery();

  if (isLoading) return <Splash />;

  if (!data) return <SignedOutRoutes />;
  if (!data.organisation) return <OnboardingPage />;

  return (
    <SessionProvider value={data}>
      <WorkspaceRoutes />
    </SessionProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
