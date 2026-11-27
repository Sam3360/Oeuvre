import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { api, ApiError, type MatchAllocation, type MatchResponse } from "../api";
import {
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  SectionCard,
  primaryButton,
  textareaClass,
} from "../components/ui";
import { categoryLabel, conditionLabel, formatMoney } from "../lib";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  covered: "Covered",
  partial: "Partly covered",
  uncovered: "No match yet",
};

export default function MatchesPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: queryError } = useQuery({
    queryKey: ["/api/oeuvre/events", id, "matches"],
    queryFn: () => api.get<MatchResponse>(`/events/${id}/matches`),
    enabled: Number.isFinite(id) && id > 0,
  });

  const keyFor = (requirementId: number, allocation: MatchAllocation) =>
    `${requirementId}:${allocation.equipmentId}:${allocation.ownerOrganisationId}`;

  const chosen = useMemo(() => {
    const groups = data?.match.requirements ?? [];
    return groups.flatMap((group) =>
      group.allocations.filter(
        (allocation) =>
          allocation.allocatedQuantity > 0 &&
          excluded[keyFor(group.requirement.id, allocation)] !== true,
      ),
    );
  }, [data, excluded]);

  const items = useMemo(() => {
    const quantities = new Map<number, number>();
    for (const allocation of chosen) {
      quantities.set(
        allocation.equipmentId,
        Math.min(
          allocation.quantityAvailable,
          (quantities.get(allocation.equipmentId) ?? 0) + allocation.allocatedQuantity,
        ),
      );
    }
    return Array.from(quantities.entries()).map(([equipmentId, quantity]) => ({
      equipmentId,
      quantity,
    }));
  }, [chosen]);

  const estimatedCost = useMemo(
    () =>
      data
        ? data.match.requirements.reduce(
            (sum, group) =>
              sum +
              group.allocations
                .filter((allocation) => excluded[keyFor(group.requirement.id, allocation)] !== true)
                .reduce((groupSum, allocation) => groupSum + allocation.estimatedCost, 0),
            0,
          )
        : 0,
    [data, excluded],
  );

  const bookingMutation = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>("/bookings", {
        eventId: id,
        items,
        message: message.trim() || undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/events"] });
      toast({ title: "Requests sent", description: result.message });
      navigate("/bookings?tab=outgoing");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not send these requests.");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-28 w-full" />
        <div className="skeleton h-72 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Wand2}
        title="Matching could not run"
        description={
          queryError instanceof ApiError
            ? queryError.message
            : "Add equipment requirements to this event, then try again."
        }
        action={
          <Link href={`/events/${id}`}>
            <span className="cursor-pointer rounded-lg bg-forest px-4 py-2 text-[13px] font-semibold text-cream">
              Back to the event
            </span>
          </Link>
        }
      />
    );
  }

  const { event, match } = data;
  const uncovered = match.requirements.filter((group) => group.status === "uncovered").length;

  return (
    <div className="space-y-6">
      <Link href={`/events/${event.id}`}>
        <span className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {event.name}
        </span>
      </Link>

      <PageHeader
        eyebrow="Matching results"
        title={`${Math.round(match.coveragePercent)}% of this event can be covered`}
        description={`${match.candidateCount} listings from other organisations were scored on category, quantity, distance, condition and cost over ${match.eventDays} day${match.eventDays === 1 ? "" : "s"}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Coverage", value: `${Math.round(match.coveragePercent)}%` },
          { label: "Match score", value: `${Math.round(match.matchScore)}/100` },
          { label: "Estimated cost", value: formatMoney(estimatedCost) },
          {
            label: "Requirements unmatched",
            value: String(uncovered),
          },
        ].map((stat) => (
          <div key={stat.label} className="surface p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-forest">{stat.value}</p>
          </div>
        ))}
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          {match.requirements.map((group) => (
            <SectionCard
              key={group.requirement.id}
              title={`${group.requirement.quantity} × ${group.requirement.label}`}
              description={`${categoryLabel(group.requirement.category)} · ${STATUS_LABELS[group.status] ?? group.status}`}
              bodyClassName="space-y-3"
            >
              {group.allocations.length === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[12.5px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  No organisation has enough free {categoryLabel(group.requirement.category).toLowerCase()} for
                  these dates. Try nearby dates or reduce the quantity.
                </div>
              ) : (
                group.allocations.map((allocation) => {
                  const key = keyFor(group.requirement.id, allocation);
                  const selected = excluded[key] !== true;
                  return (
                    <label
                      key={key}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                        selected ? "border-moss/50 bg-lime/15" : "border-border bg-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-input accent-forest"
                        checked={selected}
                        onChange={(changeEvent) =>
                          setExcluded((current) => ({ ...current, [key]: !changeEvent.target.checked }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13.5px] font-semibold text-forest">
                            {allocation.allocatedQuantity} × {allocation.name}
                          </p>
                          <span className="rounded-full bg-cream px-2 py-0.5 text-[10.5px] font-semibold text-forest">
                            {Math.round(allocation.score)}/100
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {allocation.ownerName} · {allocation.ownerCity}
                          {allocation.distanceKm != null ? ` · ${allocation.distanceKm.toFixed(1)} km` : ""} ·{" "}
                          {conditionLabel(allocation.condition)}
                        </p>
                        <p className="mt-1 text-[11.5px] text-forest/70">
                          {allocation.dailyRate > 0
                            ? `${formatMoney(allocation.dailyRate)} per unit/day · ${formatMoney(allocation.estimatedCost)} total`
                            : "Free to borrow"}
                        </p>
                        {allocation.reasons.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {allocation.reasons.slice(0, 3).map((reason) => (
                              <span
                                key={reason}
                                className="inline-flex items-center gap-1 rounded-md bg-forest/[0.06] px-1.5 py-0.5 text-[10.5px] text-forest"
                              >
                                <CheckCircle2 className="h-3 w-3 text-moss" />
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {allocation.warnings.length > 0 ? (
                          <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-800">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {allocation.warnings.join(" · ")}
                          </p>
                        ) : null}
                      </div>
                    </label>
                  );
                })
              )}
              {group.shortfall > 0 ? (
                <p className="text-[11.5px] text-muted-foreground">
                  {group.shortfall} unit{group.shortfall === 1 ? "" : "s"} still unmatched.
                </p>
              ) : null}
            </SectionCard>
          ))}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <SectionCard title="Send requests" description="Only approved bookings reserve stock.">
            <div className="space-y-4">
              <div className="rounded-xl bg-cream/70 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selected</p>
                <p className="mt-1 font-display text-xl font-bold text-forest">
                  {items.reduce((sum, item) => sum + item.quantity, 0)} units
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {items.length} listing{items.length === 1 ? "" : "s"} · {formatMoney(estimatedCost)} estimated
                </p>
              </div>

              <Field label="Message to owners" htmlFor="matchMessage" hint="Pickup plans, timing, access notes.">
                <textarea
                  id="matchMessage"
                  className={textareaClass}
                  value={message}
                  onChange={(changeEvent) => setMessage(changeEvent.target.value)}
                  placeholder="We can collect on the morning of the event and return the next day."
                />
              </Field>

              <button
                type="button"
                disabled={items.length === 0 || bookingMutation.isPending}
                onClick={() => {
                  setError(null);
                  bookingMutation.mutate();
                }}
                className={cn(
                  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  primaryButton,
                )}
              >
                {bookingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {bookingMutation.isPending
                  ? "Sending requests…"
                  : items.length === 0
                    ? "Select at least one match"
                    : "Send booking requests"}
              </button>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                Each owner approves separately. Stock is re-checked at approval time, so a request
                can only be accepted if the units are still free for these dates.
              </p>
            </div>
          </SectionCard>

          <div className="surface bg-forest p-5 text-cream">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lime">How scoring works</p>
            <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-cream/70">
              <li>Quantity 30 · category 20 · distance 20 · condition 15 · cost 15</li>
              <li>Distance uses organisation coordinates when both sides have them.</li>
              <li>Availability is total quantity minus approved overlapping bookings.</li>
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-cream/45">
              <MapPin className="h-3 w-3" /> Scores explain the fit — they are not a guarantee.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
