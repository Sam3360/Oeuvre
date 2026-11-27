import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MapPin, Save } from "lucide-react";
import { api, ApiError, type Organisation } from "../api";
import { useSession } from "../session";
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
import { eventStatusLabel, formatDate } from "../lib";
import { ORG_TYPES } from "@shared/oeuvre";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Overview {
  organisation: Organisation;
  stats: { listings: number; units: number; freeListings: number; events: number };
  events: {
    eventId: number;
    eventName: string;
    startDate: string;
    endDate: string;
    status: string;
  }[];
}

export default function OrganisationPage() {
  const { organisation: sessionOrganisation } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    type: "other",
    description: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    address: "",
    city: "",
    pincode: "",
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/organisation"],
    queryFn: () => api.get<Overview>("/organisation"),
  });

  useEffect(() => {
    const organisation = data?.organisation ?? sessionOrganisation;
    if (!organisation) return;
    setForm({
      name: organisation.name ?? "",
      type: organisation.type ?? "other",
      description: organisation.description ?? "",
      contactName: organisation.contactName ?? "",
      contactEmail: organisation.contactEmail ?? "",
      contactPhone: organisation.contactPhone ?? "",
      website: organisation.website ?? "",
      address: organisation.address ?? "",
      city: organisation.city ?? "",
      pincode: organisation.pincode ?? "",
      latitude: organisation.latitude ?? "",
      longitude: organisation.longitude ?? "",
    });
  }, [data, sessionOrganisation]);

  const mutation = useMutation({
    mutationFn: () =>
      api.patch<{ organisation: Organisation }>("/organisation", {
        name: form.name.trim(),
        type: form.type,
        description: form.description.trim() || null,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        website: form.website.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        pincode: form.pincode.trim() || null,
        latitude: form.latitude.trim() ? Number(form.latitude) : null,
        longitude: form.longitude.trim() ? Number(form.longitude) : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/organisation"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/auth/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/equipment"] });
      setError(null);
      setFieldErrors({});
      toast({ title: "Organisation updated" });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not save these details. Please try again.");
      }
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-10 w-52" />
        <div className="skeleton h-80 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Organisation could not load"
        description="Refresh the page to try again."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation profile"
        title={data.organisation.name}
        description="Other organisations see this profile when they consider a match. Keep contact details and coordinates current — distance is part of the match score."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active listings", value: data.stats.listings },
          { label: "Units owned", value: data.stats.units },
          { label: "Free listings", value: data.stats.freeListings },
          { label: "Events planned", value: data.stats.events },
        ].map((stat) => (
          <div key={stat.label} className="surface p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-forest">{stat.value}</p>
          </div>
        ))}
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Profile details">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setFieldErrors({});
              if (!form.name.trim() || !form.city.trim() || !form.address.trim()) {
                setError("Name, city and address are required.");
                return;
              }
              mutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organisation name" htmlFor="orgName" required error={fieldErrors.name}>
                <input
                  id="orgName"
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </Field>
              <Field label="Type" htmlFor="orgType" error={fieldErrors.type}>
                <select
                  id="orgType"
                  className={inputClass}
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                >
                  {ORG_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact name" htmlFor="orgContact" required error={fieldErrors.contactName}>
                <input
                  id="orgContact"
                  className={inputClass}
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                />
              </Field>
              <Field label="Contact email" htmlFor="orgEmail" required error={fieldErrors.contactEmail}>
                <input
                  id="orgEmail"
                  type="email"
                  className={inputClass}
                  value={form.contactEmail}
                  onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                />
              </Field>
              <Field label="Contact phone" htmlFor="orgPhone" required error={fieldErrors.contactPhone}>
                <input
                  id="orgPhone"
                  className={inputClass}
                  value={form.contactPhone}
                  onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                />
              </Field>
              <Field label="Website" htmlFor="orgWebsite" error={fieldErrors.website}>
                <input
                  id="orgWebsite"
                  className={inputClass}
                  value={form.website}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  placeholder="https://example.org"
                />
              </Field>
            </div>

            <Field label="About" htmlFor="orgDescription" error={fieldErrors.description}>
              <textarea
                id="orgDescription"
                className={textareaClass}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="What your organisation does and the events you run."
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Address"
                htmlFor="orgAddress"
                required
                error={fieldErrors.address}
                className="sm:col-span-2"
              >
                <input
                  id="orgAddress"
                  className={inputClass}
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                />
              </Field>
              <Field label="City" htmlFor="orgCity" required error={fieldErrors.city}>
                <input
                  id="orgCity"
                  className={inputClass}
                  value={form.city}
                  onChange={(event) => setForm({ ...form, city: event.target.value })}
                />
              </Field>
              <Field label="PIN code" htmlFor="orgPincode" error={fieldErrors.pincode}>
                <input
                  id="orgPincode"
                  className={inputClass}
                  value={form.pincode}
                  onChange={(event) => setForm({ ...form, pincode: event.target.value })}
                />
              </Field>
              <Field
                label="Latitude"
                htmlFor="orgLatitude"
                error={fieldErrors.latitude}
                hint="Optional. Enables distance scoring."
              >
                <input
                  id="orgLatitude"
                  className={inputClass}
                  value={form.latitude}
                  onChange={(event) => setForm({ ...form, latitude: event.target.value })}
                  placeholder="18.5204"
                />
              </Field>
              <Field label="Longitude" htmlFor="orgLongitude" error={fieldErrors.longitude}>
                <input
                  id="orgLongitude"
                  className={inputClass}
                  value={form.longitude}
                  onChange={(event) => setForm({ ...form, longitude: event.target.value })}
                  placeholder="73.8567"
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold disabled:opacity-60",
                primaryButton,
              )}
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {mutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </form>
        </SectionCard>

        <div className="space-y-4">
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest/[0.06] text-forest">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold text-forest">
                  {data.organisation.name}
                </p>
                <p className="text-[11.5px] text-muted-foreground">
                  {data.organisation.city}
                </p>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[12px] text-forest/75">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
              {data.organisation.address}
            </p>
            <Link href={`/organisations/${data.organisation.id}`}>
              <span className="mt-3 inline-block cursor-pointer text-[12px] font-semibold text-forest hover:underline">
                View public profile
              </span>
            </Link>
          </div>

          <SectionCard title="Your events" bodyClassName="p-0">
            {data.events.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  compact
                  title="No events yet"
                  description="Events you plan appear here with their status."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {data.events.slice(0, 8).map((event) => (
                  <li key={event.eventId} className="flex items-center justify-between gap-2 px-5 py-3">
                    <Link href={`/events/${event.eventId}`}>
                      <span className="min-w-0 cursor-pointer">
                        <span className="block truncate text-[12.5px] font-medium text-forest">
                          {event.eventName}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDate(event.startDate)}
                        </span>
                      </span>
                    </Link>
                    <StatusBadge status={event.status} label={eventStatusLabel(event.status)} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
