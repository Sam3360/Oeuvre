import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Boxes,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
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
import { api, ApiError, type EquipmentItem } from "../api";
import { EquipmentFormDialog } from "../components/equipment-form";
import { CategoryGlyph } from "../components/category-icon";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
  inputClass,
  primaryButton,
} from "../components/ui";
import {
  categoryLabel,
  conditionLabel,
  formatDateRange,
  formatMoney,
  formatNumber,
} from "../lib";
import { EQUIPMENT_CATEGORIES } from "@shared/oeuvre";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EquipmentItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/oeuvre/equipment", { includeArchived }],
    queryFn: () =>
      api.get<{ items: EquipmentItem[] }>(
        `/equipment${includeArchived ? "?includeInactive=true" : ""}`,
      ),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ archived: boolean; message: string }>(`/equipment/${id}`),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/equipment"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      setArchiveTarget(null);
      toast({ title: result.archived ? "Listing archived" : "Listing removed", description: result.message });
    },
    onError: (err) => {
      toast({
        title: "Could not update this listing",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term);
      const matchesCategory = category === "all" || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [items, search, category]);

  const totals = items.reduce(
    (acc, item) => {
      acc.units += item.quantityTotal;
      acc.available += item.quantityAvailable ?? 0;
      return acc;
    },
    { units: 0, available: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your inventory"
        title="What you can lend"
        description="Every listing is a reuse opportunity: equipment sitting unused in your store room becomes available to nearby organisations instead of being bought again. Keep quantities and availability honest so matches stay reliable."
        action={
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold",
              primaryButton,
            )}
          >
            <Plus className="h-4 w-4" />
            Add equipment
          </button>
        }
      />

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Listings", value: formatNumber(items.length) },
            { label: "Units owned", value: formatNumber(totals.units) },
            { label: "Units free right now", value: formatNumber(totals.available) },
          ].map((stat) => (
            <div key={stat.label} className="surface flex items-center justify-between px-5 py-4">
              <span className="text-[12px] text-muted-foreground">{stat.label}</span>
              <span className="font-display text-xl font-bold text-forest">{stat.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      <SectionCard bodyClassName="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              placeholder="Search your inventory"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search your inventory"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <select
              className={cn(inputClass, "w-auto min-w-[160px]")}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {EQUIPMENT_CATEGORIES.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[12px] text-forest">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-forest"
            />
            Show archived
          </label>
        </div>
      </SectionCard>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="surface p-4">
              <div className="skeleton h-36 w-full" />
              <div className="skeleton mt-4 h-4 w-2/3" />
              <div className="skeleton mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Inventory could not load"
          description={error instanceof Error ? error.message : "Please refresh and try again."}
        />
      ) : filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Your inventory is empty"
            description="Add the equipment you already own — chairs, tables, projectors, speakers, canopies. Listing it lets other organisations reuse it for their events instead of buying the same thing new."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className={cn("inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold", primaryButton)}
              >
                <Plus className="h-4 w-4" /> Add your first item
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No items match those filters"
            description="Try a different search term or category."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
                className="rounded-lg border border-border bg-white px-3.5 py-2 text-[12px] font-medium text-forest"
              >
                Clear filters
              </button>
            }
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const available = item.quantityAvailable ?? item.quantityTotal;
            const ratio = item.quantityTotal ? available / item.quantityTotal : 0;
            return (
              <article
                key={item.id}
                className="surface surface-interactive group flex flex-col overflow-hidden"
              >
                <div className="relative h-36 bg-cream/60">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-forest/25">
                      {item.isActive ? (
                        <CategoryGlyph category={item.category} className="h-10 w-10" />
                      ) : (
                        <ImageOff className="h-8 w-8" />
                      )}
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-1.5">
                    {!item.isActive ? (
                      <StatusBadge status="cancelled" label="Archived" />
                    ) : available === 0 ? (
                      <StatusBadge status="pending" label="Fully booked" />
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/equipment/${item.id}`}>
                        <h3 className="cursor-pointer truncate font-display text-[15px] font-semibold text-forest hover:underline">
                          {item.name}
                        </h3>
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {categoryLabel(item.category)} · {conditionLabel(item.condition)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cream px-2 py-1 text-[11px] font-semibold text-forest">
                      {item.dailyRate > 0 ? `${formatMoney(item.dailyRate)}/day` : "Free"}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Availability</span>
                      <span className="font-medium text-forest">
                        {available} of {item.quantityTotal}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-forest/[0.08]">
                      <div
                        className={cn("h-full rounded-full", available === 0 ? "bg-amber-400" : "bg-moss")}
                        style={{ width: `${Math.max(4, ratio * 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {item.availabilityStart || item.availabilityEnd
                      ? `Lending window: ${formatDateRange(item.availabilityStart, item.availabilityEnd)}`
                      : "Lending year-round"}
                  </p>

                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item);
                        setFormOpen(true);
                      }}
                      className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-[12px] font-medium text-forest transition-colors hover:bg-cream"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchiveTarget(item)}
                      disabled={!item.isActive}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-cream hover:text-forest disabled:opacity-40"
                      aria-label={`Archive ${item.name}`}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <EquipmentFormDialog open={formOpen} onOpenChange={setFormOpen} item={editing} />

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-forest">
              Remove “{archiveTarget?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.quantityBooked && archiveTarget.quantityBooked > 0
                ? "This item has approved bookings. It will be archived so existing handovers stay intact."
                : "If this listing has no booking history it is deleted. Otherwise it is archived and hidden from matching."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep listing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
              className="bg-forest text-cream hover:bg-forest-deep"
            >
              {archiveMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Remove listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
