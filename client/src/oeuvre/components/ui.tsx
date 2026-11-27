import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { AlertCircle, ArrowRight, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------- buttons ------------------------------- */

export const primaryButton =
  "bg-forest text-cream hover:bg-forest-deep active:bg-forest-deep shadow-soft";
export const limeButton = "bg-lime text-forest hover:bg-lime/80 shadow-soft";

/* ------------------------------ page header ---------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-moss">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-[26px] font-bold leading-tight text-forest sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* -------------------------------- stats -------------------------------- */

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "default" | "lime" | "attention";
}) {
  return (
    <div
      className={cn(
        "surface p-5 transition-shadow hover:shadow-lift",
        tone === "lime" && "border-forest/10 bg-lime/35",
        tone === "attention" && "border-amber-200 bg-amber-50/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-forest/[0.06] text-forest">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-display text-3xl font-bold leading-none text-forest">{value}</p>
      {detail ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

/* ------------------------------ empty state ----------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-forest/15 bg-white/70 text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime/50 text-forest">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-base font-semibold text-forest">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- loading ------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="surface p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-white py-16 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}…
    </div>
  );
}

/* ------------------------------ status badge --------------------------- */

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-lime/60 text-forest ring-forest/15",
  returned: "bg-forest/10 text-forest ring-forest/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  cancelled: "bg-stone-100 text-stone-600 ring-stone-200",
  planning: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-lime/60 text-forest ring-forest/15",
  completed: "bg-forest/10 text-forest ring-forest/20",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        STATUS_STYLES[status] ?? "bg-stone-100 text-stone-700 ring-stone-200",
      )}
    >
      {label}
    </span>
  );
}

/* -------------------------------- fields ------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-forest">
        {label}
        {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1 text-xs text-rose-600">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted-foreground/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30 disabled:cursor-not-allowed disabled:opacity-60";

export const textareaClass =
  "flex min-h-[92px] w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted-foreground/70 focus-visible:border-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/30";

/* ------------------------------ section card --------------------------- */

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface overflow-hidden", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-semibold text-forest">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ------------------------------ misc bits ------------------------------ */

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-forest underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
