import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  MapPin,
  Plus,
  Users,
  Wand2,
} from "lucide-react";
import { api, type EventItem } from "../api";
import {
  EmptyState,
  PageHeader,
  StatusBadge,
  primaryButton,
} from "../components/ui";
import { eventStatusLabel, eventTypeLabel, formatDateRange, formatNumber, todayIso } from "../lib";
import { cn } from "@/lib/utils";

export default function EventsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/events"],
    queryFn: () => api.get<{ items: EventItem[] }>("/events"),
  });

  const events = data?.items ?? [];
  const today = todayIso();
  const upcoming = events.filter((event) => event.endDate >= today && event.status !== "cancelled");
  const past = events.filter((event) => event.endDate < today || event.status === "cancelled");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Events"
        title="Plan what you need"
        description="Create an event with its equipment requirements, then let Oeuvre find available items from nearby organisations."
        action={
          <Link href="/events/new">
            <span className={cn("inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold", primaryButton)}>
              <Plus className="h-4 w-4" />
              Plan an event
            </span>
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="surface h-28 p-5">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton mt-3 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState title="Events could not load" description="Refresh the page and try again." />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Start with your next school day, society meeting or community drive. Add the equipment list and Oeuvre handles the search."
          action={
            <Link href="/events/new">
              <span className={cn("inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold", primaryButton)}>
                <Plus className="h-4 w-4" /> Plan your first event
              </span>
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[15px] font-semibold text-forest">Upcoming</h2>
              <span className="text-[11.5px] text-muted-foreground">
                {upcoming.length} event{upcoming.length === 1 ? "" : "s"}
              </span>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarDays}
                title="Nothing on the calendar"
                description="Create an event to start matching equipment."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {upcoming.map((event) => (
                  <article key={event.id} className="surface surface-interactive p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={event.status} label={eventStatusLabel(event.status)} />
                          <span className="text-[11px] font-medium uppercase tracking-wide text-moss">
                            {eventTypeLabel(event.eventType)}
                          </span>
                        </div>
                        <Link href={`/events/${event.id}`}>
                          <h3 className="mt-2 cursor-pointer truncate font-display text-lg font-bold text-forest hover:underline">
                            {event.name}
                          </h3>
                        </Link>
                      </div>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-lime/40 text-forest">
                        <CalendarDays className="h-[18px] w-[18px]" />
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-forest/75">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-moss" />
                        {formatDateRange(event.startDate, event.endDate)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-moss" />
                        {event.attendance ? `${formatNumber(event.attendance)} expected` : "Attendance not set"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-moss" />
                        {event.venue || event.city}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5 text-moss" />
                        {event.requirementCount ?? 0} requirements
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Link href={`/events/${event.id}/match`}>
                        <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-forest px-3.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-forest-deep">
                          <Wand2 className="h-3.5 w-3.5" />
                          Find matches
                        </span>
                      </Link>
                      <Link href={`/events/${event.id}`}>
                        <span className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-forest transition-colors hover:bg-cream">
                          Event details <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </Link>
                      {event.bookingCount ? (
                        <span className="ml-auto text-[11.5px] text-muted-foreground">
                          {event.bookingCount} booking{event.bookingCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 ? (
            <section>
              <h2 className="mb-3 font-display text-[15px] font-semibold text-forest">Past & cancelled</h2>
              <div className="surface divide-y divide-border/70">
                {past.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <div className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-cream/40">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-forest">
                        {event.name}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {formatDateRange(event.startDate, event.endDate)}
                      </span>
                      <StatusBadge status={event.status} label={eventStatusLabel(event.status)} />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
