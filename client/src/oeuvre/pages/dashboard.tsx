import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Handshake,
  Inbox,
  Leaf,
  Plus,
  RotateCcw,
} from "lucide-react";
import { api, type DashboardResponse } from "../api";
import { useSession } from "../session";
import { PageHeader, StatCard, SectionCard, EmptyState, LoadingCards, StatusBadge } from "../components/ui";
import { bookingStatusLabel, eventStatusLabel, formatDate, formatNumber, formatMoney } from "../lib";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { organisation, user } = useSession();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/oeuvre/dashboard"],
    queryFn: () => api.get<DashboardResponse>("/dashboard"),
  });

  const firstName = user.name.split(" ")[0];
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-20 w-full" />
        <LoadingCards />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="We could not load your dashboard"
        description={error instanceof Error ? error.message : "Refresh the page to try again."}
      />
    );
  }

  const { stats, recentBookings, upcomingEvents } = data;
  const attention = recentBookings.filter(
    (booking) =>
      (booking.ownerOrganisationId === organisation?.id && booking.status === "pending") ||
      (booking.ownerOrganisationId === organisation?.id &&
        booking.status === "returned" &&
        !booking.returnConfirmedAt),
  );
  const awaitingConfirmation = stats.awaitingReturnConfirmation;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={today}
        title={`Good to see you, ${firstName}.`}
        description={`Here is what is happening at ${organisation?.name ?? "your organisation"} — inventory, event planning and the handovers in motion.`}
        action={
          <>
            <Link href="/inventory">
              <span className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-[13px] font-medium text-forest transition-colors hover:bg-cream">
                <Plus className="h-4 w-4" />
                Add equipment
              </span>
            </Link>
            <Link href="/events/new">
              <span className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[13px] font-semibold text-cream transition-colors hover:bg-forest-deep">
                <CalendarDays className="h-4 w-4" />
                Plan an event
              </span>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending requests"
          value={formatNumber(stats.incomingPending)}
          detail={stats.incomingPending ? "Waiting for your decision" : "Nothing to approve"}
          icon={Inbox}
          tone={stats.incomingPending ? "attention" : "default"}
        />
        <StatCard
          label="Your requests out"
          value={formatNumber(stats.outgoingPending)}
          detail={stats.outgoingPending ? "Awaiting owner approval" : "No open requests"}
          icon={Handshake}
        />
        <StatCard
          label="Units available"
          value={formatNumber(stats.availableUnits)}
          detail={`${formatNumber(stats.units)} units across ${formatNumber(stats.listings)} listings`}
          icon={Boxes}
        />
        <StatCard
          label="Completed shares"
          value={formatNumber(stats.completedShares)}
          detail={`${formatNumber(stats.activeLoans)} handovers active`}
          icon={CheckCircle2}
          tone="lime"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard
          title="Needs your attention"
          description="Requests you own and returns waiting to be confirmed."
          action={
            <Link href="/bookings">
              <span className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-forest hover:underline">
                All bookings <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          }
          bodyClassName="p-0"
        >
          {attention.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                icon={ClipboardCheck}
                title="You are all caught up"
                description="New booking requests and return confirmations will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {attention.slice(0, 4).map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-cream text-forest">
                    {booking.status === "pending" ? (
                      <Inbox className="h-4 w-4" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-forest">
                      {booking.equipment?.name ?? "Equipment"} · {booking.quantity} units
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {booking.borrower?.name} · {booking.event?.name} ·{" "}
                      {formatDate(booking.startDate, false)}
                    </p>
                  </div>
                  <StatusBadge
                    status={booking.status}
                    label={booking.status === "pending" ? "Needs approval" : "Return pending"}
                  />
                  <Link href="/bookings?tab=incoming">
                    <span className="text-[12px] font-semibold text-forest hover:underline">Review</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Upcoming events"
          action={
            <Link href="/events">
              <span className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-forest hover:underline">
                All events <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          }
          bodyClassName="p-0"
        >
          {upcomingEvents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                icon={CalendarDays}
                title="No events yet"
                description="Plan your first event and Oeuvre will find the equipment."
                action={
                  <Link href="/events/new">
                    <span className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-forest px-3 py-2 text-[12px] font-semibold text-cream">
                      Plan event
                    </span>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {upcomingEvents.map((event) => (
                <li key={event.eventId} className="px-5 py-4">
                  <Link href={`/events/${event.eventId}`}>
                    <span className="flex cursor-pointer items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-forest">{event.eventName}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {formatDate(event.startDate)}
                        </p>
                      </div>
                      <StatusBadge status={event.status} label={eventStatusLabel(event.status)} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Recent activity"
          className="lg:col-span-2"
          bodyClassName="p-0"
          action={
            <Link href="/bookings">
              <span className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-forest hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          }
        >
          {recentBookings.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                icon={Handshake}
                title="No bookings yet"
                description="Once you request or approve equipment, the handover timeline appears here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {recentBookings.map((booking) => {
                const incoming = booking.ownerOrganisationId === organisation?.id;
                const counterpart = incoming ? booking.borrower?.name : booking.owner?.name;
                return (
                  <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <span
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                        incoming ? "bg-lime/50 text-forest" : "bg-forest/[0.06] text-forest",
                      )}
                    >
                      {incoming ? "Lending" : "Borrowing"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-forest">
                        {booking.quantity} × {booking.equipment?.name ?? "Equipment"}
                      </p>
                      <p className="truncate text-[11.5px] text-muted-foreground">
                        {counterpart} · {formatDate(booking.startDate, false)} →{" "}
                        {formatDate(booking.endDate, false)}
                      </p>
                    </div>
                    {booking.totalCost > 0 ? (
                      <span className="text-[12px] font-medium text-forest">
                        {formatMoney(booking.totalCost)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-moss">Free</span>
                    )}
                    <StatusBadge
                      status={booking.status}
                      label={bookingStatusLabel(booking.status)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4">
          <div className="surface bg-forest p-5 text-cream">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-lime">
              <Leaf className="h-3 w-3" /> Sharing record
            </span>
            <p className="mt-4 font-display text-2xl font-bold">{formatNumber(stats.completedShares)}</p>
            <p className="mt-1 text-[12px] text-cream/65">
              completed handovers recorded by your organisation.
            </p>
            <Link href="/impact">
              <span className="mt-4 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-lime hover:underline">
                See shared impact <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          {awaitingConfirmation > 0 ? (
            <div className="surface border-amber-200 bg-amber-50/70 p-4">
              <p className="text-[13px] font-semibold text-amber-900">
                {awaitingConfirmation} return{awaitingConfirmation > 1 ? "s" : ""} to confirm
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800/80">
                A borrower marked equipment as returned. Confirm receipt to close the
                handover.
              </p>
              <Link href="/bookings?tab=incoming">
                <span className="mt-2 inline-block text-[12px] font-semibold text-amber-900 hover:underline">
                  Confirm returns
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
