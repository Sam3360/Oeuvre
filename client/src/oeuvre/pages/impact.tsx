import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Factory, Info, Recycle, Trash2, Users } from "lucide-react";
import { api, type ImpactResponse } from "../api";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  LoadingCards,
  StatusBadge,
} from "../components/ui";
import { formatMoney, formatNumber } from "../lib";

export default function ImpactPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/oeuvre/impact"],
    queryFn: () => api.get<ImpactResponse>("/impact"),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="skeleton h-12 w-64" />
        <LoadingCards />
        <div className="skeleton h-56 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Impact could not load"
        description="Refresh the page to try again."
        icon={BarChart3}
      />
    );
  }

  const { actual, estimates } = data;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Shared impact"
        title="What this network has actually shared"
        description="Measured figures come from approved, returned and confirmed bookings. Estimates are shown separately and are never mixed into the measured numbers."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-moss" />
          <h2 className="font-display text-[15px] font-semibold text-forest">Measured</h2>
          <StatusBadge status="approved" label="From booking records" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Completed handovers"
            value={formatNumber(actual.completedShares)}
            detail="Returned and confirmed by the owner"
            icon={CheckCircle2}
            tone="lime"
          />
          <StatCard
            label="Units reused"
            value={formatNumber(actual.unitsReused)}
            detail={`Across ${formatNumber(actual.distinctItemsReused)} distinct listings`}
            icon={BarChart3}
          />
          <StatCard
            label="Active loans"
            value={formatNumber(actual.activeLoans)}
            detail={`${formatNumber(actual.openRequests)} open requests`}
            icon={Users}
          />
          <StatCard
            label="Organisations"
            value={formatNumber(actual.participatingOrganisations)}
            detail={`${formatNumber(actual.registeredOrganisations)} registered in total`}
            icon={Users}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active listings", value: actual.activeListings },
            { label: "Listed units", value: actual.listedUnits },
            { label: "Purchases avoided (confirmed)", value: actual.purchasesAvoidedConfirmed },
          ].map((item) => (
            <div key={item.label} className="surface flex items-center justify-between px-5 py-4">
              <span className="text-[12px] text-muted-foreground">{item.label}</span>
              <span className="font-display text-xl font-bold text-forest">
                {formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <SectionCard
        title="Estimated value"
        description="Modelled from a reference rental and purchase cost per category. This is an estimate, not a measurement."
        action={<StatusBadge status="pending" label="Estimate" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-cream/70 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Estimated rental value avoided
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-forest">
              {formatMoney(estimates.estimatedSavings)}
            </p>
          </div>
          <div className="rounded-xl bg-lime/30 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Confirmed purchases avoided
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-forest">
              {formatMoney(estimates.confirmedPurchasesAvoidedValue)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-forest">
            <Info className="h-3.5 w-3.5 text-moss" /> How these numbers are produced
          </p>
          <ul className="mt-2 space-y-1.5">
            {Object.entries(estimates.methodology).map(([key, value]) => (
              <li key={key} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-moss" />
                <span>
                  <span className="font-medium text-forest/80">{key.replace(/_/g, " ")}: </span>
                  {value}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 rounded-lg bg-cream/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          These are money estimates, not environmental measurements. They are kept apart from the
          measured sharing figures above and are never presented as verified savings.
        </p>
      </SectionCard>

      <SectionCard
        title="Environmental benefit: not measured"
        description="Sharing is designed to reduce waste and avoid new manufacturing. Oeuvre does not report a carbon or waste figure, because it cannot verify one."
        action={<StatusBadge status="cancelled" label="Not measured" />}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Recycle,
              title: "Existing stock stays in use",
              body: "Every completed handover puts equipment back into service instead of leaving it idle in a store room.",
            },
            {
              icon: Factory,
              title: "Purchases can be avoided",
              body: "When a borrower confirms they would otherwise have bought the item, that purchase — and the manufacturing behind it — did not happen.",
            },
            {
              icon: Trash2,
              title: "Less ends up as waste",
              body: "Lent equipment returns to its owner for the next event, rather than being bought for one use and discarded.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-[#FAFAF6] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-lime/50 text-forest">
                <item.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-[13px] font-semibold text-forest">{item.title}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-lg bg-cream/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Manufacturing emissions and waste depend on the product, material and supply chain.
          Without product-level data, any kg CO₂e or tonnes-of-waste figure would be invented, so
          none is shown. What the platform can honestly report is how much equipment was borrowed,
          how many purchases borrowers confirmed were avoidable, and which organisations took part
          — the measured figures above.
        </p>
      </SectionCard>
    </div>
  );
}
