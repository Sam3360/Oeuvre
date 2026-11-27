import {
  ORG_TYPES,
  EQUIPMENT_CATEGORIES,
  CONDITIONS,
  BOOKING_STATUSES,
  EVENT_TYPES,
  labelFor,
} from "@shared/oeuvre";

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDate(value: string | null | undefined, withYear = true): string {
  const date = parseDateOnly(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return "Dates not set";
  const startDate = parseDateOnly(start);
  const endDate = parseDateOnly(end);
  if (!startDate || !endDate) return "Dates not set";
  if (start === end) return formatDate(start);
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  return `${formatDate(start, !sameYear)} – ${formatDate(end)}`;
}

export function formatMoney(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount ?? 0));
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN").format(value ?? 0);
}

export function dayCount(start: string, end: string): number {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export const categoryLabel = (value: string | null | undefined) =>
  labelFor(EQUIPMENT_CATEGORIES, value);
export const orgTypeLabel = (value: string | null | undefined) => labelFor(ORG_TYPES, value);
export const conditionLabel = (value: string | null | undefined) => labelFor(CONDITIONS, value);
export const bookingStatusLabel = (value: string | null | undefined) =>
  labelFor(BOOKING_STATUSES, value);
export const eventTypeLabel = (value: string | null | undefined) => labelFor(EVENT_TYPES, value);

export const EVENT_STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function eventStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return EVENT_STATUS_LABELS[value] ?? value;
}

export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseDateOnly(iso) ?? new Date();
  date.setDate(date.getDate() + days);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Downscale and compress an uploaded image so listings stay lightweight. */
export function fileToCompressedDataUrl(file: File, maxSize = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose an image file (JPG, PNG or WebP)"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("That image is larger than 8 MB. Please choose a smaller one."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Could not read that image"));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Your browser could not process that image"));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
