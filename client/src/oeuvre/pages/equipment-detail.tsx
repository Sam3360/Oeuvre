import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError, type EquipmentItem, type EventItem, type Organisation } from "../api";
import { useSession } from "../session";
import { CategoryGlyph } from "../components/category-icon";
import {
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  SectionCard,
  StatusBadge,
  inputClass,
  primaryButton,
  textareaClass,
} from "../components/ui";
import {
  bookingStatusLabel,
  categoryLabel,
  conditionLabel,
  formatDateRange,
  formatMoney,
  orgTypeLabel,
} from "../lib";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function EquipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { organisation } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [requestOpen, setRequestOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/equipment", id],
    queryFn: () =>
      api.get<{ item: EquipmentItem; organisation: Organisation | null }>(`/equipment/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });

  const { data: eventsData } = useQuery({
    queryKey: ["/api/oeuvre/events"],
    queryFn: () => api.get<{ items: EventItem[] }>("/events"),
    enabled: requestOpen,
  });

  const bookingMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>("/bookings", {
        eventId: Number(eventId),
        items: [{ equipmentId: id, quantity: Number(quantity) }],
        message: message.trim() || undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      setRequestOpen(false);
      setMessage("");
      toast({ title: "Request sent", description: result.message });
      window.location.href = "/bookings?tab=outgoing";
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Could not send this request.");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-72 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Listing not found"
        description="This item may have been archived by its owner."
        action={
          <Link href="/inventory">
            <span className="rounded-lg bg-forest px-4 py-2 text-[13px] font-semibold text-cream">
              Back to inventory
            </span>
          </Link>
        }
      />
    );
  }

  const { item, organisation: owner } = data;
  const isOwn = organisation?.id === item.organisationId;
  const available = item.quantityAvailable ?? item.quantityTotal;
  const events = eventsData?.items ?? [];
  const openEvents = events.filter((event) => event.status === "planning" || event.status === "confirmed");

  return (
    <div className="space-y-6">
      <Link href={isOwn ? "/inventory" : "/events"}>
        <span className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" />
          {isOwn ? "Back to inventory" : "Back"}
        </span>
      </Link>

      <PageHeader
        eyebrow={isOwn ? "Your listing" : `Listed by ${owner?.name ?? "an organisation"}`}
        title={item.name}
        description={`${categoryLabel(item.category)} · ${conditionLabel(item.condition)} condition`}
        action={
          isOwn ? (
            <Link href="/inventory">
              <span className={cn("inline-flex h-10 cursor-pointer items-center rounded-lg px-4 text-[13px] font-semibold", primaryButton)}>
                Manage listing
              </span>
            </Link>
          ) : (
            <button
              type="button"
              disabled={available === 0}
              onClick={() => {
                setFormError(null);
                setQuantity("1");
                setEventId(openEvents[0] ? String(openEvents[0].id) : "");
                setRequestOpen(true);
              }}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                primaryButton,
              )}
            >
              <Send className="h-4 w-4" />
              {available === 0 ? "Fully booked" : "Request this equipment"}
            </button>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <div className="surface overflow-hidden">
            <div className="h-64 bg-cream/60 sm:h-80">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-forest/25">
                  <CategoryGlyph category={item.category} className="h-14 w-14" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={available > 0 ? "approved" : "pending"}
                  label={available > 0 ? `${available} available` : "Fully booked"}
                />
                <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-forest">
                  {categoryLabel(item.category)}
                </span>
                <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-medium text-forest">
                  {conditionLabel(item.condition)}
                </span>
              </div>

              <p className="mt-4 text-[13.5px] leading-relaxed text-forest/80">
                {item.description || "The owner has not added a description for this item yet."}
              </p>

              <dl className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Quantity owned</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-forest">{item.quantityTotal} units</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Borrowing cost</dt>
                  <dd className="mt-0.5 text-[14px] font-semibold text-forest">
                    {item.dailyRate > 0 ? `${formatMoney(item.dailyRate)} per unit / day` : "Free to borrow"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lending window</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] text-forest">
                    <CalendarDays className="h-3.5 w-3.5 text-moss" />
                    {item.availabilityStart || item.availabilityEnd
                      ? formatDateRange(item.availabilityStart, item.availabilityEnd)
                      : "Year-round"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Pickup</dt>
                  <dd className="mt-0.5 flex items-start gap-1.5 text-[13px] text-forest">
                    <PackageCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                    {item.pickupNotes || "Coordinate directly with the owner"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionCard title="Owner" bodyClassName="p-5">
            {owner ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest/[0.06] text-forest">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-forest">{owner.name}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {orgTypeLabel(owner.type)} · {owner.city}
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-[12.5px] text-forest/80">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-moss" />
                    {owner.address}
                  </p>
                  <a href={`mailto:${owner.contactEmail}`} className="flex items-center gap-2 hover:underline">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-moss" />
                    {owner.contactEmail}
                  </a>
                  <a href={`tel:${owner.contactPhone}`} className="flex items-center gap-2 hover:underline">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-moss" />
                    {owner.contactPhone}
                  </a>
                </div>
                <Link href={`/organisations/${owner.id}`}>
                  <span className="mt-4 inline-block cursor-pointer text-[12px] font-semibold text-forest hover:underline">
                    View organisation profile
                  </span>
                </Link>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Owner details unavailable.</p>
            )}
          </SectionCard>

          <div className="rounded-2xl border border-forest/10 bg-lime/30 p-5">
            <p className="font-display text-[13px] font-semibold text-forest">How booking works</p>
            <ol className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-forest/75">
              <li>1. Send a request with your event dates.</li>
              <li>2. The owner approves or declines — stock is reserved only on approval.</li>
              <li>3. Collect, use and return the equipment; both sides confirm the handover.</li>
            </ol>
          </div>
        </div>
      </div>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-forest">Request {item.name}</DialogTitle>
            <DialogDescription>
              Choose which event needs this equipment. The booking runs for the full event
              dates ({formatDateRange(item.availabilityStart, item.availabilityEnd) !== "Dates not set" ? "see event" : "see event"}).
            </DialogDescription>
          </DialogHeader>

          {formError ? <ErrorNote message={formError} /> : null}

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              if (!eventId) {
                setFormError("Choose an event for this request.");
                return;
              }
              if (Number(quantity) < 1 || Number(quantity) > available) {
                setFormError(`Choose between 1 and ${available} units.`);
                return;
              }
              bookingMutation.mutate();
            }}
          >
            <Field label="Event" htmlFor="requestEvent" required>
              {openEvents.length ? (
                <select
                  id="requestEvent"
                  className={inputClass}
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                >
                  {openEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} · {formatDateRange(event.startDate, event.endDate)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
                  You need an open event first.{" "}
                  <Link href="/events/new">
                    <span className="cursor-pointer font-semibold text-forest hover:underline">Plan one</span>
                  </Link>
                  .
                </div>
              )}
            </Field>

            <Field label="Quantity" htmlFor="requestQuantity" required hint={`${available} units available for now.`}>
              <input
                id="requestQuantity"
                type="number"
                min={1}
                max={available}
                className={inputClass}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Field>

            <Field label="Message to the owner" htmlFor="requestMessage" hint="Pickup timing, access needs, anything useful.">
              <textarea
                id="requestMessage"
                className={textareaClass}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="We can collect on the morning of the event."
              />
            </Field>

            <DialogFooter className="gap-2">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-forest hover:bg-cream"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingMutation.isPending || openEvents.length === 0}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60",
                  primaryButton,
                )}
              >
                {bookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send request
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
