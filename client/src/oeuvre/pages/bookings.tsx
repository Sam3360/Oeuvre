import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Handshake,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError, type Booking } from "../api";
import {
  EmptyState,
  ErrorNote,
  Field,
  PageHeader,
  StatusBadge,
  primaryButton,
  textareaClass,
} from "../components/ui";
import { bookingStatusLabel, formatDateRange, formatMoney } from "../lib";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "incoming" | "outgoing";
type Action = "approve" | "reject" | "cancel" | "return" | "confirm";

const ACTION_COPY: Record<
  Action,
  { title: string; description: string; cta: string; tone: "primary" | "danger" }
> = {
  approve: {
    title: "Approve this request",
    description:
      "The units are reserved for these dates once you approve. Stock is re-checked so two events can never book the same units.",
    cta: "Approve booking",
    tone: "primary",
  },
  reject: {
    title: "Decline this request",
    description:
      "The borrower is told the request was declined. Tell them why so they can look for another option.",
    cta: "Decline request",
    tone: "danger",
  },
  cancel: {
    title: "Cancel your request",
    description:
      "Withdraw this request before or after approval. If it was approved, the units are released back to the owner.",
    cta: "Cancel request",
    tone: "danger",
  },
  return: {
    title: "Mark as returned",
    description:
      "Use this once the equipment is back with its owner. The owner then confirms receipt to close the handover.",
    cta: "Mark returned",
    tone: "primary",
  },
  confirm: {
    title: "Confirm the return",
    description:
      "Confirm you have the equipment back in the condition it left in. This closes the handover and records it in your impact numbers.",
    cta: "Confirm return",
    tone: "primary",
  },
};

export default function BookingsPage() {
  const search = useSearch();
  const initialTab: Tab =
    new URLSearchParams(search).get("tab") === "incoming" ? "incoming" : "outgoing";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dialog, setDialog] = useState<{ booking: Booking; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [purchaseAvoided, setPurchaseAvoided] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/bookings"],
    queryFn: () =>
      api.get<{
        bookings: Booking[];
        summary: { pending: number; approved: number; returned: number; awaitingConfirmation: number };
        organisationId: number;
      }>("/bookings"),
  });

  const actionMutation = useMutation({
    mutationFn: ({ booking, action }: { booking: Booking; action: Action }) => {
      const path = action === "confirm" ? "confirm-return" : action;
      const body =
        action === "return"
          ? { purchaseAvoided }
          : action === "approve" || action === "reject"
            ? { note: note.trim() || undefined }
            : undefined;
      return api.post<{ message: string }>(`/bookings/${booking.id}/${path}`, body);
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/impact"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/equipment"] });
      toast({ title: result.message });
      setDialog(null);
      setNote("");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not update this booking.");
    },
  });

  const bookings = data?.bookings ?? [];
  const organisationId = data?.organisationId;
  const incoming = useMemo(
    () => bookings.filter((booking) => booking.ownerOrganisationId === organisationId),
    [bookings, organisationId],
  );
  const outgoing = useMemo(
    () => bookings.filter((booking) => booking.borrowerOrganisationId === organisationId),
    [bookings, organisationId],
  );
  const list = tab === "incoming" ? incoming : outgoing;

  const openDialog = (booking: Booking, action: Action) => {
    setDialog({ booking, action });
    setNote("");
    setError(null);
    setPurchaseAvoided(false);
  };

  const canAct = (booking: Booking, action: Action) => {
    switch (action) {
      case "approve":
      case "reject":
        return booking.ownerOrganisationId === organisationId && booking.status === "pending";
      case "cancel":
        return (
          booking.borrowerOrganisationId === organisationId &&
          (booking.status === "pending" || booking.status === "approved")
        );
      case "return":
        return booking.borrowerOrganisationId === organisationId && booking.status === "approved";
      case "confirm":
        return (
          booking.ownerOrganisationId === organisationId &&
          booking.status === "returned" &&
          !booking.returnConfirmedAt
        );
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-48" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bookings"
        title="Requests, handovers and returns"
        description="Approve what you can lend, track what you have requested, and close the loop when equipment comes back."
      />

      {isError ? (
        <EmptyState title="Bookings could not load" description="Refresh the page and try again." />
      ) : (
        <>
          <div className="inline-flex rounded-xl border border-border bg-white p-1">
            {(
              [
                { id: "incoming" as Tab, label: `Incoming (${incoming.length})` },
                { id: "outgoing" as Tab, label: `Your requests (${outgoing.length})` },
              ]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTab(option.id)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition-colors",
                  tab === option.id ? "bg-forest text-cream" : "text-forest/65 hover:bg-forest/[0.05]",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {data && (data.summary.pending > 0 || data.summary.awaitingConfirmation > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.summary.pending > 0 ? (
                <div className="surface border-amber-200 bg-amber-50/70 px-4 py-3">
                  <p className="text-[13px] font-semibold text-amber-900">
                    {data.summary.pending} request{data.summary.pending === 1 ? "" : "s"} awaiting a decision
                  </p>
                </div>
              ) : null}
              {data.summary.awaitingConfirmation > 0 ? (
                <div className="surface border-lime/40 bg-lime/30 px-4 py-3">
                  <p className="text-[13px] font-semibold text-forest">
                    {data.summary.awaitingConfirmation} return
                    {data.summary.awaitingConfirmation === 1 ? "" : "s"} to confirm
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {list.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={tab === "incoming" ? "No incoming requests" : "You have not requested anything yet"}
              description={
                tab === "incoming"
                  ? "When another organisation requests your inventory for an event, it appears here for approval."
                  : "Plan an event, run a match, and send requests to the organisations that can cover it."
              }
              action={
                <Link href={tab === "incoming" ? "/inventory" : "/events/new"}>
                  <span
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold",
                      primaryButton,
                    )}
                  >
                    {tab === "incoming" ? "Review your inventory" : "Plan an event"}
                  </span>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {list.map((booking) => {
                const counterpart =
                  tab === "incoming" ? booking.borrower?.name : booking.owner?.name;
                return (
                  <article key={booking.id} className="surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={booking.status}
                            label={bookingStatusLabel(booking.status)}
                          />
                          {booking.purchaseAvoided ? (
                            <span className="rounded-full bg-lime/50 px-2.5 py-1 text-[10.5px] font-semibold text-forest">
                              Purchase avoided
                            </span>
                          ) : null}
                        </div>
                        <h2 className="mt-2 font-display text-[16px] font-bold text-forest">
                          {booking.quantity} × {booking.equipment?.name ?? "Equipment"}
                        </h2>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {counterpart ?? "Organisation"} · {booking.event?.name ?? "Event"} ·{" "}
                          {formatDateRange(booking.startDate, booking.endDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[16px] font-bold text-forest">
                          {booking.totalCost > 0 ? formatMoney(booking.totalCost) : "Free"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {booking.dailyRate > 0
                            ? `${formatMoney(booking.dailyRate)} / unit / day`
                            : "No charge"}
                        </p>
                      </div>
                    </div>

                    {booking.message ? (
                      <p className="mt-3 rounded-lg bg-cream/70 px-3 py-2 text-[12px] leading-relaxed text-forest/80">
                        {booking.message}
                      </p>
                    ) : null}
                    {booking.responseNote ? (
                      <p className="mt-2 rounded-lg bg-forest/[0.05] px-3 py-2 text-[12px] leading-relaxed text-forest/80">
                        Owner note: {booking.responseNote}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canAct(booking, "approve") ? (
                        <button
                          type="button"
                          onClick={() => openDialog(booking, "approve")}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold",
                            primaryButton,
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                      ) : null}
                      {canAct(booking, "reject") ? (
                        <button
                          type="button"
                          onClick={() => openDialog(booking, "reject")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-forest hover:bg-cream"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Decline
                        </button>
                      ) : null}
                      {canAct(booking, "cancel") ? (
                        <button
                          type="button"
                          onClick={() => openDialog(booking, "cancel")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-muted-foreground hover:border-rose-200 hover:text-rose-600"
                        >
                          Cancel request
                        </button>
                      ) : null}
                      {canAct(booking, "return") ? (
                        <button
                          type="button"
                          onClick={() => openDialog(booking, "return")}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-[12.5px] font-medium text-forest hover:bg-cream"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Mark returned
                        </button>
                      ) : null}
                      {canAct(booking, "confirm") ? (
                        <button
                          type="button"
                          onClick={() => openDialog(booking, "confirm")}
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold",
                            primaryButton,
                          )}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirm return
                        </button>
                      ) : null}
                      {booking.status === "approved" &&
                      booking.ownerOrganisationId === organisationId ? (
                        <span className="text-[11.5px] text-muted-foreground">
                          On loan — the borrower marks it returned
                        </span>
                      ) : null}
                      <Link
                        href={booking.equipment ? `/equipment/${booking.equipment.id}` : "/inventory"}
                      >
                        <span className="ml-auto cursor-pointer text-[12px] font-medium text-forest hover:underline">
                          View listing
                        </span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          {dialog ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl text-forest">
                  {ACTION_COPY[dialog.action].title}
                </DialogTitle>
                <DialogDescription>{ACTION_COPY[dialog.action].description}</DialogDescription>
              </DialogHeader>

              {error ? <ErrorNote message={error} /> : null}

              <div className="rounded-xl bg-cream/70 px-3 py-2.5 text-[12.5px] text-forest">
                <p className="font-semibold">
                  {dialog.booking.quantity} × {dialog.booking.equipment?.name ?? "Equipment"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {formatDateRange(dialog.booking.startDate, dialog.booking.endDate)} ·{" "}
                  {dialog.booking.totalCost > 0 ? formatMoney(dialog.booking.totalCost) : "Free"}
                </p>
              </div>

              {dialog.action === "approve" || dialog.action === "reject" ? (
                <Field
                  label={dialog.action === "approve" ? "Note for the borrower" : "Reason"}
                  htmlFor="bookingNote"
                  hint="Optional, but useful for pickup plans or a clear decline."
                >
                  <textarea
                    id="bookingNote"
                    className={textareaClass}
                    value={note}
                    onChange={(changeEvent) => setNote(changeEvent.target.value)}
                    placeholder={
                      dialog.action === "approve"
                        ? "Collect from the main gate between 9 and 11 am."
                        : "We need these for our own event that weekend."
                    }
                  />
                </Field>
              ) : null}

              {dialog.action === "return" ? (
                <label className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-[12.5px] text-forest">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-input accent-forest"
                    checked={purchaseAvoided}
                    onChange={(changeEvent) => setPurchaseAvoided(changeEvent.target.checked)}
                  />
                  <span>
                    This booking replaced a purchase we would otherwise have made.
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Only tick this if it is true — it feeds the confirmed purchase-avoided count.
                    </span>
                  </span>
                </label>
              ) : null}

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-forest hover:bg-cream"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({ booking: dialog.booking, action: dialog.action })
                  }
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60",
                    ACTION_COPY[dialog.action].tone === "danger"
                      ? "bg-rose-600 text-white hover:bg-rose-700"
                      : primaryButton,
                  )}
                >
                  {actionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {ACTION_COPY[dialog.action].cta}
                </button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
