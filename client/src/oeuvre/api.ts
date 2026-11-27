/**
 * Typed client for the Oeuvre API. Every request includes the session cookie,
 * and errors are surfaced with field-level messages where the server has them.
 */
export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/oeuvre${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "include",
    });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = (payload ?? {}) as { message?: string; fieldErrors?: Record<string, string> };
    throw new ApiError(
      data.message || `Request failed (${response.status})`,
      response.status,
      data.fieldErrors ?? {},
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/* ----------------------------- API types ---------------------------- */

export type OrganisationType = "school" | "society" | "ngo" | "club" | "other";

export interface Organisation {
  id: number;
  name: string;
  type: string;
  description: string | null;
  city: string;
  address: string;
  pincode?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  website: string | null;
  logoUrl: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface MeResponse {
  user: SessionUser;
  organisation: Organisation | null;
}

export interface EquipmentItem {
  id: number;
  organisationId: number;
  name: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  quantityTotal: number;
  quantityBooked?: number;
  quantityAvailable?: number;
  condition: string;
  dailyRate: number;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  pickupNotes: string | null;
  isActive: boolean;
  organisation?: { id: number; name: string; type: string; city: string };
}

export interface EventItem {
  id: number;
  name: string;
  eventType: string;
  description: string | null;
  startDate: string;
  endDate: string;
  attendance: number;
  venue: string | null;
  city: string;
  status: string;
  requirementCount?: number;
  bookingCount?: number;
}

export interface Requirement {
  id: number;
  eventId: number;
  label: string;
  category: string;
  quantity: number;
  notes: string | null;
}

export interface EventDetail extends EventItem {
  requirements: Requirement[];
}

export interface Booking {
  id: number;
  eventId: number;
  equipmentId: number;
  borrowerOrganisationId: number;
  ownerOrganisationId: number;
  quantity: number;
  startDate: string;
  endDate: string;
  dailyRate: number;
  totalCost: number;
  status: string;
  message: string | null;
  responseNote: string | null;
  purchaseAvoided: boolean;
  decidedAt: string | null;
  returnedAt: string | null;
  returnConfirmedAt: string | null;
  createdAt: string;
  event: { id: number; name: string; startDate: string; endDate: string; city: string; venue: string | null } | null;
  equipment: { id: number; name: string; category: string; condition: string; imageUrl: string | null } | null;
  borrower: Organisation | null;
  owner: Organisation | null;
}

export interface DashboardResponse {
  organisation: Organisation;
  stats: {
    listings: number;
    units: number;
    freeListings: number;
    events: number;
    incomingPending: number;
    outgoingPending: number;
    activeLoans: number;
    awaitingReturnConfirmation: number;
    completedShares: number;
    availableUnits: number;
  };
  upcomingEvents: { eventId: number; eventName: string; startDate: string; endDate: string; status: string }[];
  recentBookings: Booking[];
}

export interface ImpactResponse {
  generatedAt: string;
  actual: {
    completedShares: number;
    activeLoans: number;
    openRequests: number;
    unitsReused: number;
    distinctItemsReused: number;
    purchasesAvoidedConfirmed: number;
    participatingOrganisations: number;
    registeredOrganisations: number;
    activeListings: number;
    listedUnits: number;
  };
  estimates: {
    estimatedSavings: number;
    confirmedPurchasesAvoidedValue: number;
    methodology: Record<string, string>;
  };
}

export interface MatchAllocation {
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
  score: number;
  breakdown: { category: number; quantity: number; distance: number; condition: number; cost: number; total: number };
  reasons: string[];
  warnings: string[];
  estimatedCost: number;
  requestedQuantity: number;
  allocatedQuantity: number;
}

export interface MatchResponse {
  event: EventDetail;
  match: {
    eventDays: number;
    coveragePercent: number;
    totalEstimatedCost: number;
    totalAllocated: number;
    totalRequested: number;
    matchScore: number;
    candidateCount: number;
    requirements: {
      requirement: { id: number; label: string; category: string; quantity: number };
      status: "covered" | "partial" | "uncovered";
      allocations: MatchAllocation[];
      shortfall: number;
      estimatedCost: number;
      bestScore: number | null;
    }[];
  };
}
