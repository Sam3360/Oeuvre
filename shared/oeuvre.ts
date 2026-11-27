/**
 * Oeuvre domain rules, shared by the API and the web client.
 *
 * This module is intentionally dependency-free: it contains only pure
 * functions and constants so both the server (matching, validation) and the
 * browser (labels, formatting) can import it safely.
 */

export const ORG_TYPES = [
  { value: "individual", label: "Individual / household" },
  { value: "school", label: "School" },
  { value: "society", label: "Housing society" },
  { value: "ngo", label: "NGO" },
  { value: "club", label: "Club" },
  { value: "other", label: "Other" },
] as const;

export type OrgType = (typeof ORG_TYPES)[number]["value"];

export const EQUIPMENT_CATEGORIES = [
  { value: "seating", label: "Seating", keywords: ["chair", "seat", "stool", "bench", "chairs", "seating"] },
  { value: "tables", label: "Tables & desks", keywords: ["table", "desk", "counter", "tables"] },
  { value: "audio", label: "Audio & sound", keywords: ["speaker", "mic", "microphone", "sound", "pa", "amp", "amplifier", "mixer", "audio"] },
  { value: "lighting", label: "Lighting", keywords: ["light", "lamp", "spot", "led", "flood", "lights"] },
  { value: "stage", label: "Stage & trussing", keywords: ["stage", "truss", "podium", "riser", "backdrop", "curtain", "dais"] },
  { value: "projection", label: "Projection & screens", keywords: ["projector", "screen", "display", "tv", "monitor", "led wall"] },
  { value: "power", label: "Power & cabling", keywords: ["generator", "extension", "cable", "power", "inverter", "distribution"] },
  { value: "sports", label: "Sports & grounds", keywords: ["goal", "net", "mat", "cone", "cricket", "football", "badminton", "hurdle"] },
  { value: "furniture", label: "Furniture", keywords: ["sofa", "almirah", "rack", "shelf", "mattress", "cupboard"] },
  { value: "tools", label: "Tools & utilities", keywords: ["drill", "ladder", "tool", "tent", "canopy", "fan", "cooler", "barricade"] },
  { value: "other", label: "Other", keywords: [] },
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number]["value"];

export const CONDITIONS = [
  { value: "new", label: "New", score: 15 },
  { value: "excellent", label: "Excellent", score: 13 },
  { value: "good", label: "Good", score: 10 },
  { value: "fair", label: "Fair", score: 6 },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];

export const BOOKING_STATUSES = [
  { value: "pending", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number]["value"];

export const EVENT_TYPES = [
  { value: "annual-day", label: "Annual day" },
  { value: "sports-day", label: "Sports day" },
  { value: "cultural-fest", label: "Cultural fest" },
  { value: "conference", label: "Conference" },
  { value: "workshop", label: "Workshop" },
  { value: "community-drive", label: "Community drive" },
  { value: "other", label: "Other" },
] as const;

export function labelFor(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return list.find((entry) => entry.value === value)?.label ?? value;
}

/** Infer a category from free text such as an event requirement name. */
export function inferCategory(label: string): EquipmentCategory {
  const text = label.toLowerCase();
  // Longest keywords first so "led wall" wins over "led".
  const scored = EQUIPMENT_CATEGORIES.filter((c) => c.value !== "other")
    .map((category) => {
      const hit = category.keywords.reduce(
        (best, keyword) => (text.includes(keyword) ? Math.max(best, keyword.length) : best),
        0,
      );
      return { value: category.value, hit };
    })
    .filter((entry) => entry.hit > 0)
    .sort((a, b) => b.hit - a.hit);

  return (scored[0]?.value ?? "other") as EquipmentCategory;
}

/** Great-circle distance in kilometres. */
export function distanceKm(
  aLat: number | null | undefined,
  aLng: number | null | undefined,
  bLat: number | null | undefined,
  bLng: number | null | undefined,
): number | null {
  if (
    aLat == null || aLng == null || bLat == null || bLng == null ||
    Number.isNaN(aLat) || Number.isNaN(aLng) || Number.isNaN(bLat) || Number.isNaN(bLng)
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

/** Inclusive number of days a booking spans. */
export function bookingDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export type RequirementInput = {
  id?: number;
  label: string;
  category: string;
  quantity: number;
};

export type MatchCandidate = {
  equipmentId: number;
  name: string;
  category: string;
  condition: string;
  dailyRate: number;
  quantityTotal: number;
  quantityAvailable: number;
  imageUrl: string | null;
  ownerOrganisationId: number;
  ownerName: string;
  ownerType: string;
  ownerCity: string;
  distanceKm: number | null;
};

export type ScoreBreakdown = {
  category: number;
  quantity: number;
  distance: number;
  condition: number;
  cost: number;
  total: number;
};

export type ScoredCandidate = MatchCandidate & {
  score: number;
  breakdown: ScoreBreakdown;
  reasons: string[];
  warnings: string[];
  /** Estimated cost for the quantity allocated to this requirement. */
  estimatedCost: number;
};

export type Allocation = ScoredCandidate & {
  requestedQuantity: number;
  allocatedQuantity: number;
};

export type RequirementMatch = {
  requirement: RequirementInput;
  status: "covered" | "partial" | "uncovered";
  allocations: Allocation[];
  shortfall: number;
  estimatedCost: number;
  bestScore: number | null;
};

export type MatchResult = {
  eventDays: number;
  requirements: RequirementMatch[];
  coveragePercent: number;
  totalEstimatedCost: number;
  totalAllocated: number;
  totalRequested: number;
  matchScore: number;
  candidateCount: number;
};

const WEIGHTS = {
  category: 20,
  quantity: 30,
  distance: 20,
  condition: 15,
  cost: 15,
} as const;

const CONDITION_SCORE: Record<string, number> = Object.fromEntries(
  CONDITIONS.map((c) => [c.value, c.score]),
);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Scores a single inventory listing against one event requirement.
 *
 * The score is a transparent 0–100 sum of five weighted signals, and the
 * returned `reasons`/`warnings` explain every point to the user.
 */
export function scoreCandidate(
  candidate: MatchCandidate,
  requirement: RequirementInput,
  context: { maxDailyRate: number; requiredCategory: string },
): ScoredCandidate {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Category fit — listings are pre-filtered to the requirement category, but
  // fuzzy buckets ("other") are worth fewer points.
  const categoryScore =
    candidate.category === context.requiredCategory
      ? WEIGHTS.category
      : context.requiredCategory === "other" || candidate.category === "other"
        ? WEIGHTS.category * 0.4
        : WEIGHTS.category * 0.15;

  // How much of the requested quantity this listing can actually supply.
  const availabilityRatio = Math.min(
    1,
    requirement.quantity > 0 ? candidate.quantityAvailable / requirement.quantity : 0,
  );
  const quantityScore = WEIGHTS.quantity * availabilityRatio;
  if (availabilityRatio >= 1) {
    reasons.push(`Can supply all ${requirement.quantity}`);
  } else if (candidate.quantityAvailable > 0) {
    warnings.push(`Only ${candidate.quantityAvailable} of ${requirement.quantity} available`);
  }

  // Distance.
  let distanceScore: number;
  if (candidate.distanceKm == null) {
    distanceScore = WEIGHTS.distance * 0.4;
  } else {
    distanceScore = WEIGHTS.distance * (1 - Math.min(candidate.distanceKm, 50) / 50);
    if (candidate.distanceKm <= 2) reasons.push(`${candidate.distanceKm} km away`);
    else if (candidate.distanceKm <= 10) reasons.push(`${candidate.distanceKm} km away`);
    else warnings.push(`${candidate.distanceKm} km away`);
  }

  // Condition.
  const conditionScore = CONDITION_SCORE[candidate.condition] ?? 8;
  const conditionLabel = CONDITIONS.find((c) => c.value === candidate.condition)?.label;
  if (conditionLabel && (candidate.condition === "new" || candidate.condition === "excellent")) {
    reasons.push(`${conditionLabel} condition`);
  } else if (candidate.condition === "fair") {
    warnings.push("Fair condition — inspect before booking");
  }

  // Cost: free listings earn full marks, otherwise cheaper listings score higher.
  let costScore: number;
  if (candidate.dailyRate <= 0) {
    costScore = WEIGHTS.cost;
    reasons.push("Free to borrow");
  } else {
    const ceiling = Math.max(context.maxDailyRate, candidate.dailyRate, 1);
    costScore = WEIGHTS.cost * (1 - candidate.dailyRate / ceiling);
    warnings.push(`${formatMoney(candidate.dailyRate)} per day`);
  }

  const breakdown: ScoreBreakdown = {
    category: round1(categoryScore),
    quantity: round1(quantityScore),
    distance: round1(distanceScore),
    condition: round1(conditionScore),
    cost: round1(costScore),
    total: round1(categoryScore + quantityScore + distanceScore + conditionScore + costScore),
  };

  return {
    ...candidate,
    score: breakdown.total,
    breakdown,
    reasons,
    warnings,
    estimatedCost: 0,
  };
}

/**
 * Greedily allocates the required quantity across the best-scoring listings,
 * so an event can be fulfilled by several organisations when no single one
 * holds enough stock.
 */
export function allocateMatches(
  requirements: RequirementInput[],
  candidates: MatchCandidate[],
  context: { eventDays: number },
): MatchResult {
  const eventDays = Math.max(1, context.eventDays);
  const results: RequirementMatch[] = [];

  for (const requirement of requirements) {
    const requiredCategory = requirement.category || inferCategory(requirement.label);
    const eligible = candidates.filter(
      (candidate) =>
        candidate.quantityAvailable > 0 &&
        (candidate.category === requiredCategory ||
          requiredCategory === "other" ||
          candidate.category === "other"),
    );
    const maxDailyRate = eligible.reduce((max, c) => Math.max(max, c.dailyRate), 0);

    const scored = eligible
      .map((candidate) =>
        scoreCandidate(candidate, requirement, { maxDailyRate, requiredCategory }),
      )
      .sort((a, b) => b.score - a.score);

    let remaining = requirement.quantity;
    const allocations: Allocation[] = [];

    for (const candidate of scored) {
      if (remaining <= 0) break;
      const allocatedQuantity = Math.min(remaining, candidate.quantityAvailable);
      if (allocatedQuantity <= 0) continue;
      const estimatedCost = candidate.dailyRate * allocatedQuantity * eventDays;
      allocations.push({
        ...candidate,
        requestedQuantity: requirement.quantity,
        allocatedQuantity,
        estimatedCost,
      });
      remaining -= allocatedQuantity;
    }

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    const status: RequirementMatch["status"] =
      totalAllocated >= requirement.quantity
        ? "covered"
        : totalAllocated > 0
          ? "partial"
          : "uncovered";

    results.push({
      requirement,
      status,
      allocations,
      shortfall: Math.max(0, requirement.quantity - totalAllocated),
      estimatedCost: allocations.reduce((sum, a) => sum + a.estimatedCost, 0),
      bestScore: allocations[0]?.score ?? null,
    });
  }

  const totalRequested = requirements.reduce((sum, r) => sum + r.quantity, 0);
  const totalAllocated = results.reduce(
    (sum, r) => sum + r.allocations.reduce((s, a) => s + a.allocatedQuantity, 0),
    0,
  );
  const coveragePercent =
    totalRequested > 0 ? Math.round((totalAllocated / totalRequested) * 100) : 0;
  const scoredRequirements = results.filter((r) => r.bestScore != null);
  const matchScore = scoredRequirements.length
    ? Math.round(
        scoredRequirements.reduce((sum, r) => sum + (r.bestScore ?? 0), 0) /
          scoredRequirements.length,
      )
    : 0;

  return {
    eventDays,
    requirements: results,
    coveragePercent,
    totalEstimatedCost: results.reduce((sum, r) => sum + r.estimatedCost, 0),
    totalAllocated,
    totalRequested,
    matchScore,
    candidateCount: candidates.length,
  };
}
