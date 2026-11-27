import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  MapPin,
  Trash2,
  Users,
  Wand2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, ApiError, type Booking, type EventDetail } from "../api";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
  inputClass,
  primaryButton,
} from "../components/ui";
import {
  bookingStatusLabel,
  categoryLabel,
  eventStatusLabel,
  eventTypeLabel,
  formatDateRange,
  formatMoney,
  formatNumber,
} from "../lib";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/events", id],
    queryFn: () => api.get<{ event: EventDetail; bookings: Booking[] }>(`/events/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch<{ event: EventDetail }>(`/events/${id}`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      toast({ title: "Event updated" });
    },
    onError: (err) => {
      toast({
        title: "Could not update the event",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<{ message: string }>(`/events/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      toast({ title: "Event removed" });
      navigate("/events");
    },
    onError: (err) => {
      toast({
        title: "Could not remove the event",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-44 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Event not found"
        description="This event may have been removed, or it belongs to another organisation."
        action={
          <Link href="/events">
            <span className="cursor-pointer rounded-lg bg-forest px-4 py-2 text-[13px] font-semibold text-cream">
              Back to events
            </span>
          </Link>
        }
      />
    );
  }

  const { event, bookings } = data;
  const confirmed = bookings.filter((booking) => booking.status === "approved");

  return (
    <div className="space-y-6">
      <Link href="/events">
        <span className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to events
        </span>
      </Link>

      <PageHeader
        eyebrow={eventTypeLabel(event.eventType)}
        title={event.name}
        description={event.description || "No notes were added for this event."}
        action={
          <>
            <select
              aria-label="Event status"
              value={event.status}
              disabled={statusMutation.isPending}
              onChange={(changeEvent) => statusMutation.mutate(changeEvent.target.value)}
              className={cn(inputClass, "h-10 w-auto min-w-[140px]")}
            >
              <option value="planning">Planning</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Link href={`/events/${event.id}/match`}>
              <span
                className={cn(
                  "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold",
                  primaryButton,
                )}
              >
                <Wand2 className="h-4 w-4" /> Find equipment
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-rose-200 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Dates",
            value: formatDateRange(event.startDate, event.endDate),
            icon: CalendarDays,
          },
          {
            label: "Venue",
            value: event.venue || event.city,
            icon: MapPin,
          },
          {
            label: "Expected attendance",
            value: event.attendance ? formatNumber(event.attendance) : "Not set",
            icon: Users,
          },
          {
            label: "Status",
            value: eventStatusLabel(event.status),
            icon: CalendarDays,
          },
        ].map((stat) => (
          <div key={stat.label} className="surface flex items-start gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lime/40 text-forest">
              <stat.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="mt-0.5 truncate text-[13.5px] font-semibold text-forest">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <SectionCard
          title="Equipment requirements"
          description={`${event.requirements.length} item${event.requirements.length === 1 ? "" : "s"} requested for this event.`}
        >
          {event.requirements.length === 0 ? (
            <EmptyState
              compact
              title="No requirements yet"
              description="Add what the event needs so Oeuvre can match inventory."
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {event.requirements.map((requirement) => (
                <li key={requirement.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-forest">{requirement.label}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {categoryLabel(requirement.category)}
                      {requirement.notes ? ` · ${requirement.notes}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[11.5px] font-semibold text-forest">
                    {requirement.quantity} needed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Requests from this event"
          description={`${confirmed.length} approved of ${bookings.length} request${bookings.length === 1 ? "" : "s"}.`}
          bodyClassName="p-0"
        >
          {bookings.length === 0 ? (
            <div className="p-5">
              <EmptyState
                compact
                title="No requests yet"
                description="Run a match to see which organisations can cover this event."
                action={
                  <Link href={`/events/${event.id}/match`}>
                    <span className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-forest px-3 py-2 text-[12px] font-semibold text-cream">
                      <Wand2 className="h-3.5 w-3.5" /> Find matches
                    </span>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {bookings.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-forest">
                      {booking.quantity} × {booking.equipment?.name ?? "Equipment"}
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {booking.owner?.name ?? "Owner"} ·{" "}
                      {booking.totalCost > 0 ? formatMoney(booking.totalCost) : "Free"}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} label={bookingStatusLabel(booking.status)} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-forest">
              Delete “{event.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The event and its equipment requirements are removed. Existing booking requests keep
              their history but will no longer be linked to a live event. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep event</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
