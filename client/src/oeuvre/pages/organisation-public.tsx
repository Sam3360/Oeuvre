import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, MapPin, Phone, Boxes } from "lucide-react";
import { api, type Organisation } from "../api";
import { CategoryGlyph } from "../components/category-icon";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../components/ui";
import { categoryLabel, conditionLabel, formatMoney, initials, orgTypeLabel } from "../lib";

interface PublicListing {
  id: number;
  name: string;
  category: string;
  condition: string;
  quantityTotal: number;
  quantityAvailable: number;
  dailyRate: number;
  imageUrl: string | null;
}

export default function PublicOrganisationPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/organisations", id],
    queryFn: () =>
      api.get<{ organisation: Organisation; listings: PublicListing[] }>(`/organisations/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-48 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Organisation not found"
        description="This profile may no longer be available."
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

  const { organisation, listings } = data;

  return (
    <div className="space-y-6">
      <Link href="/events">
        <span className="inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-forest">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </span>
      </Link>

      <PageHeader
        eyebrow={orgTypeLabel(organisation.type)}
        title={organisation.name}
        description={organisation.description || "This organisation has not added a description yet."}
      />

      <div className="surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-forest text-[17px] font-bold text-lime">
            {initials(organisation.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-forest">{organisation.name}</p>
            <p className="text-[12px] text-muted-foreground">
              {orgTypeLabel(organisation.type)} · {organisation.city}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-forest/80">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-moss" />
                {organisation.address}
              </span>
              <a href={`mailto:${organisation.contactEmail}`} className="flex items-center gap-1.5 hover:underline">
                <Mail className="h-3.5 w-3.5 text-moss" />
                {organisation.contactEmail}
              </a>
              <a href={`tel:${organisation.contactPhone}`} className="flex items-center gap-1.5 hover:underline">
                <Phone className="h-3.5 w-3.5 text-moss" />
                {organisation.contactPhone}
              </a>
            </div>
          </div>
          <div className="rounded-xl bg-cream/70 px-4 py-3 text-center">
            <p className="font-display text-xl font-bold text-forest">{listings.length}</p>
            <p className="text-[11px] text-muted-foreground">listings</p>
          </div>
        </div>
      </div>

      <SectionCard
        title="Available inventory"
        description="Request any of these for one of your events — the owner approves each request."
      >
        {listings.length === 0 ? (
          <EmptyState
            compact
            icon={Boxes}
            title="Nothing listed right now"
            description="This organisation has no active listings to borrow."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing) => (
              <Link key={listing.id} href={`/equipment/${listing.id}`}>
                <article className="surface surface-interactive flex h-full cursor-pointer flex-col overflow-hidden">
                  <div className="h-32 bg-cream/60">
                    {listing.imageUrl ? (
                      <img
                        src={listing.imageUrl}
                        alt={listing.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-forest/25">
                        <CategoryGlyph category={listing.category} className="h-9 w-9" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-display text-[14px] font-semibold text-forest">
                        {listing.name}
                      </p>
                      <StatusBadge
                        status={listing.quantityAvailable > 0 ? "approved" : "pending"}
                        label={
                          listing.quantityAvailable > 0
                            ? `${listing.quantityAvailable} free`
                            : "Fully booked"
                        }
                      />
                    </div>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {categoryLabel(listing.category)} · {conditionLabel(listing.condition)}
                    </p>
                    <p className="mt-auto pt-3 text-[12px] font-medium text-forest">
                      {listing.dailyRate > 0 ? `${formatMoney(listing.dailyRate)} / unit / day` : "Free"}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="flex items-center gap-2 rounded-xl border border-forest/10 bg-lime/25 px-4 py-3 text-[12px] text-forest/80">
        <Building2 className="h-4 w-4 shrink-0 text-moss" />
        Every listing belongs to a verified organisation account on Oeuvre.
      </div>
    </div>
  );
}
