import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { api, ApiError, type EventDetail } from "../api";
import { useSession } from "../session";
import {
  ErrorNote,
  Field,
  PageHeader,
  SectionCard,
  inputClass,
  primaryButton,
  textareaClass,
} from "../components/ui";
import { EVENT_TYPES, EQUIPMENT_CATEGORIES, inferCategory } from "@shared/oeuvre";
import { addDaysIso, eventTypeLabel, todayIso } from "../lib";
import { cn } from "@/lib/utils";

type RequirementRow = {
  key: string;
  label: string;
  category: string;
  quantity: string;
  notes: string;
};

function newRow(partial: Partial<RequirementRow> = {}): RequirementRow {
  return {
    key: Math.random().toString(36).slice(2),
    label: "",
    category: "other",
    quantity: "1",
    notes: "",
    ...partial,
  };
}

function starterRequirements(attendance: number): RequirementRow[] {
  const guests = Math.max(0, attendance);
  const list = [
    newRow({
      label: "Chairs",
      category: "seating",
      quantity: String(guests || 50),
      notes: "Seating for guests",
    }),
    newRow({
      label: "Tables",
      category: "tables",
      quantity: String(Math.max(1, Math.ceil((guests || 50) / 10))),
      notes: "Registration and catering tables",
    }),
    newRow({ label: "PA system", category: "audio", quantity: "1", notes: "Speakers, microphones and mixer" }),
    newRow({
      label: "Projector & screen",
      category: "projection",
      quantity: "1",
      notes: "For presentations and videos",
    }),
  ];
  return list;
}

export default function NewEventPage() {
  const { organisation } = useSession();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "",
    eventType: "annual-day",
    description: "",
    startDate: addDaysIso(todayIso(), 21),
    endDate: addDaysIso(todayIso(), 21),
    attendance: "200",
    venue: organisation?.address ?? "",
    city: organisation?.city ?? "",
  });
  const [requirements, setRequirements] = useState<RequirementRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ event: EventDetail }>("/events", {
        name: form.name.trim(),
        eventType: form.eventType,
        description: form.description.trim() || null,
        startDate: form.startDate,
        endDate: form.endDate,
        attendance: Number(form.attendance || 0),
        venue: form.venue.trim() || null,
        city: form.city.trim(),
        requirements: requirements
          .filter((row) => row.label.trim())
          .map((row) => ({
            label: row.label.trim(),
            category: row.category,
            quantity: Number(row.quantity || 1),
            notes: row.notes.trim() || null,
          })),
      }),
    onSuccess: (data) => {
      navigate(`/events/${data.event.id}/match`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not create this event. Please try again.");
      }
    },
  });

  const updateRow = (key: string, patch: Partial<RequirementRow>) => {
    setRequirements((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const submit = () => {
    setError(null);
    setFieldErrors({});
    if (!form.name.trim()) {
      setError("Give the event a name.");
      return;
    }
    if (!form.city.trim()) {
      setError("Add the event city.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("The end date cannot be before the start date.");
      return;
    }
    const valid = requirements.filter((row) => row.label.trim() && Number(row.quantity) > 0);
    if (valid.length === 0) {
      setError("Add at least one piece of equipment you need.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-6">
      <Link href="/events">
        <span className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to events
        </span>
      </Link>

      <PageHeader
        eyebrow="New event"
        title="Tell us what you are planning"
        description="The more accurate the dates and quantities, the better Oeuvre can match you with equipment that is genuinely free."
      />

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <SectionCard title="Event details">
            <div className="space-y-4">
              <Field label="Event name" htmlFor="eventName" required error={fieldErrors.name}>
                <input
                  id="eventName"
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Annual Day 2026"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event type" htmlFor="eventType" error={fieldErrors.eventType}>
                  <select
                    id="eventType"
                    className={inputClass}
                    value={form.eventType}
                    onChange={(event) => setForm({ ...form, eventType: event.target.value })}
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Expected attendance"
                  htmlFor="attendance"
                  error={fieldErrors.attendance}
                  hint="Used to suggest realistic quantities."
                >
                  <input
                    id="attendance"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={form.attendance}
                    onChange={(event) => setForm({ ...form, attendance: event.target.value })}
                  />
                </Field>
                <Field label="Start date" htmlFor="startDate" required error={fieldErrors.startDate}>
                  <input
                    id="startDate"
                    type="date"
                    className={inputClass}
                    value={form.startDate}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      setForm((current) => ({
                        ...current,
                        startDate,
                        endDate: current.endDate < startDate ? startDate : current.endDate,
                      }));
                    }}
                  />
                </Field>
                <Field label="End date" htmlFor="endDate" required error={fieldErrors.endDate}>
                  <input
                    id="endDate"
                    type="date"
                    min={form.startDate}
                    className={inputClass}
                    value={form.endDate}
                    onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Venue" htmlFor="venue" error={fieldErrors.venue}>
                  <input
                    id="venue"
                    className={inputClass}
                    value={form.venue}
                    onChange={(event) => setForm({ ...form, venue: event.target.value })}
                    placeholder="Main auditorium"
                  />
                </Field>
                <Field label="City" htmlFor="eventCity" required error={fieldErrors.city}>
                  <input
                    id="eventCity"
                    className={inputClass}
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                    placeholder="Pune"
                  />
                </Field>
              </div>

              <Field label="Notes" htmlFor="eventDescription" error={fieldErrors.description}>
                <textarea
                  id="eventDescription"
                  className={textareaClass}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Anything the equipment owners should know about the event."
                />
              </Field>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            title="Equipment requirements"
            description="One row per item you need. Category drives the match."
            action={
              <button
                type="button"
                onClick={() => setRequirements((rows) => [...rows, newRow()])}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-forest hover:bg-cream"
              >
                <Plus className="h-3.5 w-3.5" /> Add row
              </button>
            }
            bodyClassName="space-y-3"
          >
            <button
              type="button"
              onClick={() => setRequirements(starterRequirements(Number(form.attendance || 0)))}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-moss/40 bg-lime/20 px-3 py-2.5 text-left text-[12px] font-medium text-forest transition-colors hover:bg-lime/35"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-moss" />
              Use a starter list sized for {form.attendance || 0} guests
            </button>

            {requirements.map((row, index) => (
              <div key={row.key} className="rounded-xl border border-border/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Requirement {index + 1}
                  </span>
                  {requirements.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRequirements((rows) => rows.filter((item) => item.key !== row.key))}
                      className="text-muted-foreground hover:text-rose-600"
                      aria-label="Remove requirement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <input
                  className={cn(inputClass, "mt-2")}
                  value={row.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    updateRow(row.key, {
                      label,
                      category:
                        row.category === "other" ? inferCategory(label) : row.category,
                    });
                  }}
                  placeholder="e.g. Chairs with arms"
                  aria-label={`Requirement ${index + 1} name`}
                />
                <div className="mt-2 grid grid-cols-[1fr_88px] gap-2">
                  <select
                    className={inputClass}
                    value={row.category}
                    onChange={(event) => updateRow(row.key, { category: event.target.value })}
                    aria-label={`Requirement ${index + 1} category`}
                  >
                    {EQUIPMENT_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={row.quantity}
                    onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                    aria-label={`Requirement ${index + 1} quantity`}
                  />
                </div>
              </div>
            ))}
          </SectionCard>

          <div className="surface bg-forest p-5 text-cream">
            <div className="flex items-center gap-2 text-lime">
              <Wand2 className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">What happens next</p>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-cream/75">
              Oeuvre searches other organisations&apos; live inventory for these
              dates, scores each option and shows you why it fits. Nothing is
              reserved until an owner approves.
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-cream/50">
              <CalendarDays className="h-3.5 w-3.5" />
              {eventTypeLabel(form.eventType)} · {form.startDate} → {form.endDate}
            </p>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-70",
              primaryButton,
            )}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {mutation.isPending ? "Creating event…" : "Create event and find matches"}
          </button>
        </div>
      </div>
    </div>
  );
}
