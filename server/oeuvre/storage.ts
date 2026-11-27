/**
 * Data access for the Oeuvre domain. All availability is derived from
 * bookings, so there is a single source of truth for stock.
 */
import { db } from "../db";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import {
  organisations,
  equipment,
  events,
  eventRequirements,
  bookings,
  notifications,
  users,
} from "@shared/schema";
import type {
  Organisation,
  Equipment,
  Event,
  EventRequirement,
  Booking,
} from "@shared/oeuvre-schema";
import type {
  MatchCandidate,
  RequirementInput,
  MatchResult,
} from "@shared/oeuvre";
import { allocateMatches, bookingDays, distanceKm } from "@shared/oeuvre";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EquipmentWithAvailability = Equipment & {
  quantityBooked: number;
  quantityAvailable: number;
};

export type BookingDetail = {
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
  borrower: { id: number; name: string; type: string; city: string; contactEmail: string; contactPhone: string } | null;
  owner: { id: number; name: string; type: string; city: string; contactEmail: string; contactPhone: string } | null;
};

const OPEN_STATUSES = ["pending", "approved", "returned"] as const;

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/* ------------------------------------------------------------------ */
/* Organisations                                                       */
/* ------------------------------------------------------------------ */

export async function getOrganisationById(id: number): Promise<Organisation | undefined> {
  const [row] = await db.select().from(organisations).where(eq(organisations.id, id)).limit(1);
  return row;
}

export async function getOrganisationByOwner(userId: number): Promise<Organisation | undefined> {
  const [row] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.ownerUserId, userId))
    .limit(1);
  return row;
}

export async function updateOrganisation(
  id: number,
  patch: Partial<Organisation>,
): Promise<Organisation | undefined> {
  const [row] = await db
    .update(organisations)
    .set(patch)
    .where(eq(organisations.id, id))
    .returning();
  return row;
}

export async function getOrganisationOverview(id: number) {
  const org = await getOrganisationById(id);
  if (!org) return null;

  const [listingStats] = await db
    .select({
      listings: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${equipment.quantityTotal}), 0)::int`,
      freeListings: sql<number>`count(*) filter (where ${equipment.dailyRate}::numeric = 0)::int`,
    })
    .from(equipment)
    .where(and(eq(equipment.organisationId, id), eq(equipment.isActive, true)));

  const rows = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      status: events.status,
    })
    .from(events)
    .where(eq(events.organisationId, id))
    .orderBy(desc(events.createdAt))
    .limit(50);

  return {
    organisation: org,
    stats: {
      listings: listingStats?.listings ?? 0,
      units: listingStats?.units ?? 0,
      freeListings: listingStats?.freeListings ?? 0,
      events: rows.length,
    },
    events: rows,
  };
}

/* ------------------------------------------------------------------ */
/* Equipment                                                           */
/* ------------------------------------------------------------------ */

export async function listEquipmentByOrganisation(
  organisationId: number,
  options: { includeInactive?: boolean; startDate?: string; endDate?: string } = {},
): Promise<EquipmentWithAvailability[]> {
  const where = options.includeInactive
    ? eq(equipment.organisationId, organisationId)
    : and(eq(equipment.organisationId, organisationId), eq(equipment.isActive, true));

  const rows = await db
    .select()
    .from(equipment)
    .where(where)
    .orderBy(desc(equipment.createdAt));

  const booked = await bookedQuantities(
    rows.map((row) => row.id),
    options.startDate,
    options.endDate,
  );

  return rows.map((row) => {
    const quantityBooked = booked.get(row.id) ?? 0;
    return {
      ...row,
      quantityBooked,
      quantityAvailable: Math.max(0, row.quantityTotal - quantityBooked),
    };
  });
}

export async function getEquipmentById(id: number): Promise<Equipment | undefined> {
  const [row] = await db.select().from(equipment).where(eq(equipment.id, id)).limit(1);
  return row;
}

export async function createEquipment(
  organisationId: number,
  values: Omit<Equipment, "id" | "organisationId" | "createdAt" | "updatedAt" | "isActive"> & {
    isActive?: boolean;
  },
): Promise<Equipment> {
  const [row] = await db
    .insert(equipment)
    .values({ ...values, organisationId })
    .returning();
  return row;
}

export async function updateEquipment(
  id: number,
  patch: Partial<Equipment>,
): Promise<Equipment | undefined> {
  const [row] = await db
    .update(equipment)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(equipment.id, id))
    .returning();
  return row;
}

export async function equipmentHasBookings(id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.equipmentId, id), inArray(bookings.status, [...OPEN_STATUSES])))
    .limit(1);
  return Boolean(row);
}

export async function deleteEquipment(id: number): Promise<void> {
  await db.delete(equipment).where(eq(equipment.id, id));
}

/** Approved bookings per equipment for an inclusive date window. */
export async function bookedQuantities(
  equipmentIds: number[],
  startDate?: string,
  endDate?: string,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (equipmentIds.length === 0) return result;

  const conditions = [
    inArray(bookings.equipmentId, equipmentIds),
    eq(bookings.status, "approved"),
  ];
  if (startDate && endDate) {
    conditions.push(lte(bookings.startDate, endDate), gte(bookings.endDate, startDate));
  }

  const rows = await db
    .select({
      equipmentId: bookings.equipmentId,
      quantity: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
    })
    .from(bookings)
    .where(and(...conditions))
    .groupBy(bookings.equipmentId);

  for (const row of rows) result.set(row.equipmentId, row.quantity);
  return result;
}

/* ------------------------------------------------------------------ */
/* Events & requirements                                               */
/* ------------------------------------------------------------------ */

export async function listEventsByOrganisation(organisationId: number) {
  const rows = await db
    .select({
      event: events,
      requirementCount: sql<number>`(select count(*) from ${eventRequirements} where ${eventRequirements.eventId} = ${events.id})::int`,
      bookingCount: sql<number>`(select count(*) from ${bookings} where ${bookings.eventId} = ${events.id} and ${bookings.status} in ('pending','approved','returned'))::int`,
    })
    .from(events)
    .where(eq(events.organisationId, organisationId))
    .orderBy(desc(events.startDate));

  return rows.map((row) => ({
    ...row.event,
    requirementCount: row.requirementCount,
    bookingCount: row.bookingCount,
  }));
}

export async function getEventWithRequirements(
  id: number,
): Promise<(Event & { requirements: EventRequirement[] }) | undefined> {
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) return undefined;
  const requirements = await db
    .select()
    .from(eventRequirements)
    .where(eq(eventRequirements.eventId, id))
    .orderBy(asc(eventRequirements.id));
  return { ...event, requirements };
}

export async function createEventWithRequirements(
  organisationId: number,
  event: {
    name: string;
    eventType: string;
    description?: string | null;
    startDate: string;
    endDate: string;
    attendance: number;
    venue?: string | null;
    city: string;
    latitude?: string | null;
    longitude?: string | null;
    status?: string;
  },
  requirements: { label: string; category: string; quantity: number; notes?: string | null }[],
): Promise<{ event: Event; requirements: EventRequirement[] }> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(events)
      .values({ ...event, organisationId })
      .returning();

    const createdRequirements = await tx
      .insert(eventRequirements)
      .values(requirements.map((requirement) => ({ ...requirement, eventId: created.id })))
      .returning();

    return { event: created, requirements: createdRequirements };
  });
}

export async function updateEvent(
  id: number,
  patch: Partial<Event>,
): Promise<Event | undefined> {
  const [row] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
  return row;
}

export async function replaceEventRequirements(
  eventId: number,
  requirements: { label: string; category: string; quantity: number; notes?: string | null }[],
): Promise<EventRequirement[]> {
  return db.transaction(async (tx) => {
    await tx.delete(eventRequirements).where(eq(eventRequirements.eventId, eventId));
    if (requirements.length === 0) return [];
    return tx
      .insert(eventRequirements)
      .values(requirements.map((requirement) => ({ ...requirement, eventId })))
      .returning();
  });
}

export async function deleteEvent(id: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(eventRequirements).where(eq(eventRequirements.eventId, id));
    await tx.delete(bookings).where(eq(bookings.eventId, id));
    await tx.delete(events).where(eq(events.id, id));
  });
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

/**
 * Builds the candidate set for an event: every active listing from another
 * organisation with stock left for the event dates, scored and allocated by
 * the shared, rule-based matching engine.
 */
export async function matchEventInventory(
  event: Event,
  requirements: RequirementInput[],
): Promise<MatchResult> {
  const eventDays = bookingDays(event.startDate, event.endDate);

  const rows = await db
    .select({
      id: equipment.id,
      name: equipment.name,
      category: equipment.category,
      condition: equipment.condition,
      dailyRate: equipment.dailyRate,
      quantityTotal: equipment.quantityTotal,
      imageUrl: equipment.imageUrl,
      availabilityStart: equipment.availabilityStart,
      availabilityEnd: equipment.availabilityEnd,
      ownerOrganisationId: organisations.id,
      ownerName: organisations.name,
      ownerType: organisations.type,
      ownerCity: organisations.city,
      ownerLat: organisations.latitude,
      ownerLng: organisations.longitude,
    })
    .from(equipment)
    .innerJoin(organisations, eq(equipment.organisationId, organisations.id))
    .where(
      and(
        eq(equipment.isActive, true),
        ne(equipment.organisationId, event.organisationId),
        or(
          sql`${equipment.availabilityStart} is null`,
          lte(equipment.availabilityStart, event.startDate),
        ),
        or(
          sql`${equipment.availabilityEnd} is null`,
          gte(equipment.availabilityEnd, event.endDate),
        ),
      ),
    );

  const booked = await bookedQuantities(
    rows.map((row) => row.id),
    event.startDate,
    event.endDate,
  );

  const candidates: MatchCandidate[] = rows
    .map((row) => ({
      equipmentId: row.id,
      name: row.name,
      category: row.category,
      condition: row.condition,
      dailyRate: toNumber(row.dailyRate),
      quantityTotal: row.quantityTotal,
      quantityAvailable: Math.max(0, row.quantityTotal - (booked.get(row.id) ?? 0)),
      imageUrl: row.imageUrl,
      ownerOrganisationId: row.ownerOrganisationId,
      ownerName: row.ownerName,
      ownerType: row.ownerType,
      ownerCity: row.ownerCity,
      distanceKm: distanceKm(
        toNumber(event.latitude) || null,
        toNumber(event.longitude) || null,
        toNumber(row.ownerLat) || null,
        toNumber(row.ownerLng) || null,
      ),
    }))
    .filter((candidate) => candidate.quantityAvailable > 0);

  return allocateMatches(requirements, candidates, { eventDays });
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

export type CreateBookingResult =
  | { ok: true; bookingIds: number[] }
  | { ok: false; error: string; status: number };

export async function createBookingRequests(
  borrower: Organisation,
  userId: number,
  event: Event,
  items: { equipmentId: number; quantity: number }[],
  message?: string,
): Promise<CreateBookingResult> {
  const uniqueIds = new Set(items.map((item) => item.equipmentId));
  if (uniqueIds.size !== items.length) {
    return { ok: false, status: 400, error: "Each item can only be requested once" };
  }

  try {
    const result = await db.transaction(async (tx): Promise<{ bookingIds: number[] } | { error: string; status: number }> => {
      const ids = items.map((item) => item.equipmentId);
      // Lock the equipment rows so two simultaneous requests cannot both take
      // the last available units.
      await tx.execute(
        sql`select id from ${equipment} where ${inArray(equipment.id, ids)} order by id for update`,
      );

      const listings = await tx
        .select()
        .from(equipment)
        .where(inArray(equipment.id, ids));

      const bookingIds: number[] = [];
      const days = bookingDays(event.startDate, event.endDate);

      for (const item of items) {
        const listing = listings.find((row) => row.id === item.equipmentId);
        if (!listing || !listing.isActive) {
          return { error: "One of the selected items is no longer listed", status: 409 };
        }
        if (listing.organisationId === borrower.id) {
          return { error: "You cannot book your own equipment", status: 400 };
        }
        if (listing.availabilityStart && listing.availabilityStart > event.startDate) {
          return { error: `${listing.name} is not available from the event start date`, status: 409 };
        }
        if (listing.availabilityEnd && listing.availabilityEnd < event.endDate) {
          return { error: `${listing.name} is not available until the event end date`, status: 409 };
        }

        const [{ booked }] = await tx
          .select({ booked: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int` })
          .from(bookings)
          .where(
            and(
              eq(bookings.equipmentId, listing.id),
              eq(bookings.status, "approved"),
              lte(bookings.startDate, event.endDate),
              gte(bookings.endDate, event.startDate),
            ),
          );

        const available = listing.quantityTotal - booked;
        if (item.quantity > available) {
          return {
            error: available <= 0
              ? `${listing.name} is fully booked for these dates`
              : `Only ${available} of ${listing.name} remain available for these dates`,
            status: 409,
          };
        }

        const rate = toNumber(listing.dailyRate);
        const [created] = await tx
          .insert(bookings)
          .values({
            eventId: event.id,
            equipmentId: listing.id,
            borrowerOrganisationId: borrower.id,
            ownerOrganisationId: listing.organisationId,
            requestedByUserId: userId,
            quantity: item.quantity,
            startDate: event.startDate,
            endDate: event.endDate,
            dailyRate: rate.toFixed(2),
            totalCost: (rate * item.quantity * days).toFixed(2),
            status: "pending",
            message: message ?? null,
          })
          .returning();

        const [ownerOrg] = await tx
          .select({ ownerUserId: organisations.ownerUserId })
          .from(organisations)
          .where(eq(organisations.id, listing.organisationId))
          .limit(1);

        if (ownerOrg) {
          await tx.insert(notifications).values({
            userId: ownerOrg.ownerUserId,
            title: "New booking request",
            message: `${borrower.name} requested ${item.quantity} × ${listing.name} for ${event.name}.`,
            type: "booking_request",
            data: JSON.stringify({ bookingId: created.id, eventId: event.id }),
          });
        }

        bookingIds.push(created.id);
      }

      return { bookingIds };
    });

    if ("error" in result) {
      return { ok: false, status: result.status, error: result.error };
    }
    return { ok: true, bookingIds: result.bookingIds };
  } catch (error) {
    console.error("Booking request failed:", error);
    return { ok: false, status: 500, error: "Could not create the booking request" };
  }
}

const borrowerOrg = alias(organisations, "borrower_org");
const ownerOrg = alias(organisations, "owner_org");

export async function listBookingsForOrganisation(
  organisationId: number,
  role: "borrower" | "owner" | "all" = "all",
): Promise<BookingDetail[]> {
  const conditions = [];
  if (role === "borrower") conditions.push(eq(bookings.borrowerOrganisationId, organisationId));
  else if (role === "owner") conditions.push(eq(bookings.ownerOrganisationId, organisationId));
  else
    conditions.push(
      or(
        eq(bookings.borrowerOrganisationId, organisationId),
        eq(bookings.ownerOrganisationId, organisationId),
      ),
    );

  const rows = await db
    .select({
      booking: bookings,
      event: events,
      equipment: equipment,
      borrower: borrowerOrg,
      owner: ownerOrg,
    })
    .from(bookings)
    .leftJoin(events, eq(bookings.eventId, events.id))
    .leftJoin(equipment, eq(bookings.equipmentId, equipment.id))
    .leftJoin(borrowerOrg, eq(bookings.borrowerOrganisationId, borrowerOrg.id))
    .leftJoin(ownerOrg, eq(bookings.ownerOrganisationId, ownerOrg.id))
    .where(and(...conditions))
    .orderBy(desc(bookings.createdAt));

  return rows.map(mapBookingRow);
}

export async function getBookingDetail(id: number): Promise<BookingDetail | undefined> {
  const rows = await db
    .select({
      booking: bookings,
      event: events,
      equipment: equipment,
      borrower: borrowerOrg,
      owner: ownerOrg,
    })
    .from(bookings)
    .leftJoin(events, eq(bookings.eventId, events.id))
    .leftJoin(equipment, eq(bookings.equipmentId, equipment.id))
    .leftJoin(borrowerOrg, eq(bookings.borrowerOrganisationId, borrowerOrg.id))
    .leftJoin(ownerOrg, eq(bookings.ownerOrganisationId, ownerOrg.id))
    .where(eq(bookings.id, id))
    .limit(1);

  return rows[0] ? mapBookingRow(rows[0]) : undefined;
}

function mapBookingRow(row: {
  booking: Booking;
  event: Event | null;
  equipment: Equipment | null;
  borrower: Organisation | null;
  owner: Organisation | null;
}): BookingDetail {
  const { booking, event, equipment: listing, borrower, owner } = row;
  return {
    id: booking.id,
    eventId: booking.eventId,
    equipmentId: booking.equipmentId,
    borrowerOrganisationId: booking.borrowerOrganisationId,
    ownerOrganisationId: booking.ownerOrganisationId,
    quantity: booking.quantity,
    startDate: booking.startDate,
    endDate: booking.endDate,
    dailyRate: toNumber(booking.dailyRate),
    totalCost: toNumber(booking.totalCost),
    status: booking.status,
    message: booking.message,
    responseNote: booking.responseNote,
    purchaseAvoided: booking.purchaseAvoided,
    decidedAt: iso(booking.decidedAt),
    returnedAt: iso(booking.returnedAt),
    returnConfirmedAt: iso(booking.returnConfirmedAt),
    createdAt: iso(booking.createdAt) ?? "",
    event: event
      ? {
          id: event.id,
          name: event.name,
          startDate: event.startDate,
          endDate: event.endDate,
          city: event.city,
          venue: event.venue,
        }
      : null,
    equipment: listing
      ? {
          id: listing.id,
          name: listing.name,
          category: listing.category,
          condition: listing.condition,
          imageUrl: listing.imageUrl,
        }
      : null,
    borrower: borrower
      ? {
          id: borrower.id,
          name: borrower.name,
          type: borrower.type,
          city: borrower.city,
          contactEmail: borrower.contactEmail,
          contactPhone: borrower.contactPhone,
        }
      : null,
    owner: owner
      ? {
          id: owner.id,
          name: owner.name,
          type: owner.type,
          city: owner.city,
          contactEmail: owner.contactEmail,
          contactPhone: owner.contactPhone,
        }
      : null,
  };
}

export type BookingActionResult =
  | { ok: true; booking: BookingDetail }
  | { ok: false; status: number; error: string };

async function notifyUser(userId: number, title: string, message: string, data: Record<string, unknown>) {
  await db.insert(notifications).values({
    userId,
    title,
    message,
    type: "booking_update",
    data: JSON.stringify(data),
  });
}

export async function approveBooking(
  id: number,
  ownerOrganisationId: number,
  note?: string,
): Promise<BookingActionResult> {
  try {
    const outcome = await db.transaction(async (tx): Promise<{ status: number } | { error: string; status: number }> => {
      const [booking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .limit(1);

      if (!booking) return { status: 404, error: "Booking not found" };
      if (booking.ownerOrganisationId !== ownerOrganisationId) {
        return { status: 403, error: "This booking belongs to another organisation" };
      }
      if (booking.status !== "pending") {
        return { status: 409, error: `This request is already ${booking.status}` };
      }

      // Lock the listing and re-count approved stock, excluding this request.
      await tx.execute(sql`select id from ${equipment} where ${equipment.id} = ${booking.equipmentId} for update`);

      const [listing] = await tx
        .select()
        .from(equipment)
        .where(eq(equipment.id, booking.equipmentId))
        .limit(1);

      if (!listing || !listing.isActive) {
        return { status: 409, error: "This item is no longer listed" };
      }

      const [{ booked }] = await tx
        .select({ booked: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.equipmentId, booking.equipmentId),
            eq(bookings.status, "approved"),
            ne(bookings.id, booking.id),
            lte(bookings.startDate, booking.endDate),
            gte(bookings.endDate, booking.startDate),
          ),
        );

      if (booked + booking.quantity > listing.quantityTotal) {
        const remaining = Math.max(0, listing.quantityTotal - booked);
        return {
          status: 409,
          error: `Not enough stock left for these dates (${remaining} of ${listing.quantityTotal} available). Decline this request or free up stock first.`,
        };
      }

      await tx
        .update(bookings)
        .set({ status: "approved", decidedAt: new Date(), responseNote: note ?? null })
        .where(eq(bookings.id, id));

      const [owner] = await tx
        .select({ name: organisations.name })
        .from(organisations)
        .where(eq(organisations.id, ownerOrganisationId))
        .limit(1);

      await tx.insert(notifications).values({
        userId: booking.requestedByUserId,
        title: "Booking approved",
        message: `${owner?.name ?? "The owner"} approved ${booking.quantity} × ${listing.name}. Arrange pickup before ${booking.startDate}.`,
        type: "booking_approved",
        data: JSON.stringify({ bookingId: id }),
      });

      return { status: 200 };
    });

    if ("error" in outcome) {
      return { ok: false, status: outcome.status, error: outcome.error };
    }
    const detail = await getBookingDetail(id);
    return detail
      ? { ok: true, booking: detail }
      : { ok: false, status: 404, error: "Booking not found" };
  } catch (error) {
    console.error("Approve booking failed:", error);
    return { ok: false, status: 500, error: "Could not approve the booking" };
  }
}

export async function rejectBooking(
  id: number,
  ownerOrganisationId: number,
  note?: string,
): Promise<BookingActionResult> {
  return decidePending(id, ownerOrganisationId, "rejected", note, "Booking declined");
}

export async function cancelBooking(
  id: number,
  borrowerOrganisationId: number,
): Promise<BookingActionResult> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };
  if (booking.borrowerOrganisationId !== borrowerOrganisationId) {
    return { ok: false, status: 403, error: "This booking belongs to another organisation" };
  }
  if (booking.status !== "pending" && booking.status !== "approved") {
    return { ok: false, status: 409, error: `This booking is already ${booking.status}` };
  }

  await db
    .update(bookings)
    .set({ status: "cancelled", decidedAt: new Date() })
    .where(eq(bookings.id, id));

  const detail = await getBookingDetail(id);
  return detail
    ? { ok: true, booking: detail }
    : { ok: false, status: 404, error: "Booking not found" };
}

async function decidePending(
  id: number,
  ownerOrganisationId: number,
  status: "rejected",
  note: string | undefined,
  notificationTitle: string,
): Promise<BookingActionResult> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };
  if (booking.ownerOrganisationId !== ownerOrganisationId) {
    return { ok: false, status: 403, error: "This booking belongs to another organisation" };
  }
  if (booking.status !== "pending") {
    return { ok: false, status: 409, error: `This request is already ${booking.status}` };
  }

  await db
    .update(bookings)
    .set({ status, decidedAt: new Date(), responseNote: note ?? null })
    .where(eq(bookings.id, id));

  await notifyUser(
    booking.requestedByUserId,
    notificationTitle,
    note?.trim() ? note.trim() : "The owner could not fulfil this request.",
    { bookingId: id },
  );

  const detail = await getBookingDetail(id);
  return detail
    ? { ok: true, booking: detail }
    : { ok: false, status: 404, error: "Booking not found" };
}

/** Borrower marks equipment returned; the owner then confirms receipt. */
export async function markBookingReturned(
  id: number,
  borrowerOrganisationId: number,
  purchaseAvoided?: boolean,
): Promise<BookingActionResult> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };
  if (booking.borrowerOrganisationId !== borrowerOrganisationId) {
    return { ok: false, status: 403, error: "This booking belongs to another organisation" };
  }
  if (booking.status !== "approved") {
    return {
      ok: false,
      status: 409,
      error: booking.status === "returned" ? "This booking is already marked returned" : "Only approved bookings can be returned",
    };
  }

  await db
    .update(bookings)
    .set({
      status: "returned",
      returnedAt: new Date(),
      purchaseAvoided: purchaseAvoided === true,
    })
    .where(eq(bookings.id, id));

  const [owner] = await db
    .select({ ownerUserId: organisations.ownerUserId, name: organisations.name })
    .from(organisations)
    .where(eq(organisations.id, booking.ownerOrganisationId))
    .limit(1);

  if (owner) {
    await notifyUser(
      owner.ownerUserId,
      "Return marked complete",
      `A borrower marked the equipment for booking #${id} as returned. Please confirm receipt.`,
      { bookingId: id },
    );
  }

  const detail = await getBookingDetail(id);
  return detail
    ? { ok: true, booking: detail }
    : { ok: false, status: 404, error: "Booking not found" };
}

export async function confirmBookingReturn(
  id: number,
  ownerOrganisationId: number,
): Promise<BookingActionResult> {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };
  if (booking.ownerOrganisationId !== ownerOrganisationId) {
    return { ok: false, status: 403, error: "This booking belongs to another organisation" };
  }
  if (booking.status !== "returned") {
    return { ok: false, status: 409, error: "The borrower has not marked this as returned yet" };
  }
  if (booking.returnConfirmedAt) {
    return { ok: false, status: 409, error: "Return already confirmed" };
  }

  await db
    .update(bookings)
    .set({ returnConfirmedAt: new Date() })
    .where(eq(bookings.id, id));

  await notifyUser(
    booking.requestedByUserId,
    "Return confirmed",
    `The owner confirmed receipt for booking #${id}. Thanks for sharing.`,
    { bookingId: id },
  );

  const detail = await getBookingDetail(id);
  return detail
    ? { ok: true, booking: detail }
    : { ok: false, status: 404, error: "Booking not found" };
}

/* ------------------------------------------------------------------ */
/* Impact                                                              */
/* ------------------------------------------------------------------ */

/** Indicative local rental rates (INR / unit / day), used only for estimates. */
export const CATEGORY_RENTAL_BENCHMARK: Record<string, number> = {
  seating: 8,
  tables: 25,
  audio: 800,
  lighting: 400,
  stage: 1200,
  projection: 900,
  power: 700,
  sports: 150,
  furniture: 60,
  tools: 100,
  other: 200,
};

/** Indicative purchase price (INR / unit) for confirmed avoided purchases. */
export const CATEGORY_PURCHASE_BENCHMARK: Record<string, number> = {
  seating: 700,
  tables: 3500,
  audio: 25000,
  lighting: 12000,
  stage: 40000,
  projection: 35000,
  power: 30000,
  sports: 4000,
  furniture: 8000,
  tools: 5000,
  other: 6000,
};

export async function getImpactStats() {
  const rows = await db
    .select({
      booking: bookings,
      category: equipment.category,
    })
    .from(bookings)
    .leftJoin(equipment, eq(bookings.equipmentId, equipment.id));

  const returned = rows.filter((row) => row.booking.status === "returned");
  const approved = rows.filter((row) => row.booking.status === "approved");
  const pending = rows.filter((row) => row.booking.status === "pending");

  let estimatedSavings = 0;
  let confirmedPurchasesAvoidedValue = 0;
  let unitsReused = 0;
  const equipmentIds = new Set<number>();

  for (const row of returned) {
    const category = row.category ?? "other";
    const days = bookingDays(row.booking.startDate, row.booking.endDate);
    const paidRate = toNumber(row.booking.dailyRate);
    const marketRate = Math.max(paidRate, CATEGORY_RENTAL_BENCHMARK[category] ?? 200);
    estimatedSavings += row.booking.quantity * days * marketRate;
    unitsReused += row.booking.quantity;
    equipmentIds.add(row.booking.equipmentId);

    if (row.booking.purchaseAvoided) {
      confirmedPurchasesAvoidedValue +=
        row.booking.quantity * (CATEGORY_PURCHASE_BENCHMARK[category] ?? 6000);
    }
  }

  const activeBookingRows = rows.filter(
    (row) => row.booking.status === "approved" || row.booking.status === "returned",
  );
  const transactingOrgs = new Set<number>();
  for (const row of activeBookingRows) {
    transactingOrgs.add(row.booking.borrowerOrganisationId);
    transactingOrgs.add(row.booking.ownerOrganisationId);
  }

  const [orgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(organisations);
  const [listingCount] = await db
    .select({
      listings: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${equipment.quantityTotal}), 0)::int`,
    })
    .from(equipment)
    .where(eq(equipment.isActive, true));

  const confirmedPurchasesAvoided = returned.filter((row) => row.booking.purchaseAvoided).length;

  return {
    generatedAt: new Date().toISOString(),
    actual: {
      completedShares: returned.length,
      activeLoans: approved.length,
      openRequests: pending.length,
      unitsReused,
      distinctItemsReused: equipmentIds.size,
      purchasesAvoidedConfirmed: confirmedPurchasesAvoided,
      participatingOrganisations: transactingOrgs.size,
      registeredOrganisations: orgCount?.count ?? 0,
      activeListings: listingCount?.listings ?? 0,
      listedUnits: listingCount?.units ?? 0,
    },
    estimates: {
      estimatedSavings,
      confirmedPurchasesAvoidedValue,
      methodology: {
        savings:
          "For each completed booking: quantity × days × the greater of the lender's daily rate and a category rental benchmark typical of local vendors. This is an estimate, not an invoice.",
        purchasesAvoided:
          "Only bookings where the borrower confirmed they would otherwise have bought the item are counted, valued at a category purchase benchmark.",
        environmental:
          "No environmental figures are estimated. Oeuvre only reports what it can observe on the platform.",
      },
    },
  };
}
