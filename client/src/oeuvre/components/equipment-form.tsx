import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError, type EquipmentItem } from "../api";
import { EQUIPMENT_CATEGORIES, CONDITIONS } from "@shared/oeuvre";
import { fileToCompressedDataUrl } from "../lib";
import { ErrorNote, Field, inputClass, primaryButton, textareaClass } from "./ui";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  category: string;
  description: string;
  quantityTotal: string;
  condition: string;
  dailyRate: string;
  availabilityStart: string;
  availabilityEnd: string;
  pickupNotes: string;
  imageUrl: string;
};

const EMPTY: FormState = {
  name: "",
  category: "seating",
  description: "",
  quantityTotal: "1",
  condition: "good",
  dailyRate: "0",
  availabilityStart: "",
  availabilityEnd: "",
  pickupNotes: "",
  imageUrl: "",
};

export function EquipmentFormDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: EquipmentItem | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFieldErrors({});
    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        description: item.description ?? "",
        quantityTotal: String(item.quantityTotal),
        condition: item.condition,
        dailyRate: String(item.dailyRate ?? 0),
        availabilityStart: item.availabilityStart ?? "",
        availabilityEnd: item.availabilityEnd ?? "",
        pickupNotes: item.pickupNotes ?? "",
        imageUrl: item.imageUrl ?? "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        quantityTotal: Number(form.quantityTotal),
        condition: form.condition,
        dailyRate: Number(form.dailyRate || 0),
        availabilityStart: form.availabilityStart || null,
        availabilityEnd: form.availabilityEnd || null,
        pickupNotes: form.pickupNotes.trim() || null,
        imageUrl: form.imageUrl || null,
      };
      return item
        ? api.patch<{ item: EquipmentItem }>(`/equipment/${item.id}`, payload)
        : api.post<{ item: EquipmentItem }>("/equipment", payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/equipment"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/oeuvre/dashboard"] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors);
      } else {
        setError("Could not save this listing. Please try again.");
      }
    },
  });

  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((current) => ({ ...current, imageUrl: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-forest">
            {item ? "Edit listing" : "Add equipment"}
          </DialogTitle>
          <DialogDescription>
            Only list items you can genuinely lend. Unused equipment you list becomes a
            reuse option for nearby organisations, and availability is checked against
            every booking.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="mt-1">
            <ErrorNote message={error} />
          </div>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setFieldErrors({});
            if (!form.name.trim()) {
              setFieldErrors({ name: "Give this item a name" });
              return;
            }
            if (Number(form.quantityTotal) < 1) {
              setFieldErrors({ quantityTotal: "Quantity must be at least 1" });
              return;
            }
            if (
              form.availabilityStart &&
              form.availabilityEnd &&
              form.availabilityStart > form.availabilityEnd
            ) {
              setFieldErrors({ availabilityEnd: "Must be after the start date" });
              return;
            }
            mutation.mutate();
          }}
        >
          <Field label="Item name" htmlFor="equipmentName" required error={fieldErrors.name}>
            <input
              id="equipmentName"
              className={inputClass}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Plastic chairs with arms"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="equipmentCategory" required error={fieldErrors.category}>
              <select
                id="equipmentCategory"
                className={inputClass}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {EQUIPMENT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condition" htmlFor="equipmentCondition" required error={fieldErrors.condition}>
              <select
                id="equipmentCondition"
                className={inputClass}
                value={form.condition}
                onChange={(event) => setForm({ ...form, condition: event.target.value })}
              >
                {CONDITIONS.map((condition) => (
                  <option key={condition.value} value={condition.value}>
                    {condition.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Quantity you own"
              htmlFor="equipmentQuantity"
              required
              error={fieldErrors.quantityTotal}
            >
              <input
                id="equipmentQuantity"
                type="number"
                min={1}
                className={inputClass}
                value={form.quantityTotal}
                onChange={(event) => setForm({ ...form, quantityTotal: event.target.value })}
              />
            </Field>
            <Field
              label="Borrowing cost (₹ per day)"
              htmlFor="equipmentRate"
              error={fieldErrors.dailyRate}
              hint="Use 0 to lend free of charge."
            >
              <input
                id="equipmentRate"
                type="number"
                min={0}
                step="1"
                className={inputClass}
                value={form.dailyRate}
                onChange={(event) => setForm({ ...form, dailyRate: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Description" htmlFor="equipmentDescription" error={fieldErrors.description}>
            <textarea
              id="equipmentDescription"
              className={textareaClass}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Size, material, accessories included, anything a borrower should know."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Available from"
              htmlFor="availableFrom"
              error={fieldErrors.availabilityStart}
              hint="Leave blank for year-round lending."
            >
              <input
                id="availableFrom"
                type="date"
                className={inputClass}
                value={form.availabilityStart}
                onChange={(event) => setForm({ ...form, availabilityStart: event.target.value })}
              />
            </Field>
            <Field label="Available until" htmlFor="availableUntil" error={fieldErrors.availabilityEnd}>
              <input
                id="availableUntil"
                type="date"
                className={inputClass}
                value={form.availabilityEnd}
                onChange={(event) => setForm({ ...form, availabilityEnd: event.target.value })}
              />
            </Field>
          </div>

          <Field
            label="Pickup notes"
            htmlFor="pickupNotes"
            error={fieldErrors.pickupNotes}
            hint="Where and when borrowers should collect the item."
          >
            <input
              id="pickupNotes"
              className={inputClass}
              value={form.pickupNotes}
              onChange={(event) => setForm({ ...form, pickupNotes: event.target.value })}
              placeholder="Ground-floor store room, weekdays 9am–5pm"
            />
          </Field>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-forest">Photo</p>
            {form.imageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-border">
                <img src={form.imageUrl} alt="Equipment preview" className="h-40 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, imageUrl: "" })}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-forest shadow"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-forest/20 bg-cream/40 text-center transition-colors hover:border-moss hover:bg-cream/70">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-forest" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-moss" />
                )}
                <span className="text-[12.5px] font-medium text-forest">
                  {uploading ? "Processing photo…" : "Upload a photo (optional)"}
                </span>
                <span className="text-[11px] text-muted-foreground">JPG, PNG or WebP · up to 8 MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
              </label>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-lg border border-border px-4 text-sm font-medium text-forest hover:bg-cream"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || uploading}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-70",
                primaryButton,
              )}
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {item ? "Save changes" : "Add to inventory"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
