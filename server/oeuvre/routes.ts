/**
 * Oeuvre API — mounted at /api/oeuvre by the Express server.
 *
 * Every route below is scoped to the signed-in organisation, so one
 * organisation can never read or change another organisation's data.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import "express-session";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}
import { and, desc, eq, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { hashPassword, comparePasswords } from "../auth-utils";
import {
  organisations,
  equipment,
  events,
  eventRequirements,
  bookings,
  notifications,
  users,
} from "@shared/schema";
import {
  createBookingSchema,
  insertEquipmentSchema,
  insertOrganisationSchema,
  createEventWithRequirementsSchema,
  insertEventRequirementSchema,
  type Organisation,
} from "@shared/oeuvre-schema";
import { ORG_TYPES, EQUIPMENT_CATEGORIES, CONDITIONS, BOOKING_STATUSES, EVENT_TYPES, inferCategory } from "@shared/oeuvre";
import * as store from "./storage";

type AuthedRequest = Request & { organisation: Organisation; userId: number };

const registerSchema = z.object({
  organisationName: z.string().trim().min(2, "Organisation name is required").max(120),
  organisationType: z.enum(ORG_TYPES.map((type) => type.value) as [string, ...string[]]),
  contactName: z.string().trim().min(2, "Your name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(8, "Enter a valid phone number").max(20),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  city: z.string().trim().min(2, "City is required").max(80),
  address: z.string().trim().min(5, "Address is required").max(500),
  pincode: z.string().trim().max(12).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const organisationPatchSchema = insertOrganisationSchema.partial().extend({
  type: z.enum(ORG_TYPES.map((type) => type.value) as [string, ...string[]]).optional(),
});

function httpError(res: Response, status: number, message: string, extra?: Record<string, unknown>) {
  return res.status(status).json({ message, ...extra });
}

function handleZodError(res: Response, error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return res.status(400).json({
    message: error.issues[0]?.message ?? "Please check the form and try again",
    fieldErrors,
  });
}

async function requireOrganisation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.session.userId;
    if (!userId) return httpError(res, 401, "Please sign in to continue");

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return httpError(res, 401, "Your session has expired. Please sign in again");

    const organisation = user.organisationId
      ? await store.getOrganisationById(user.organisationId)
      : await store.getOrganisationByOwner(user.id);

    if (!organisation) {
      return httpError(res, 403, "Finish your organisation profile to continue", {
        code: "ORGANISATION_REQUIRED",
      });
    }

    (req as AuthedRequest).organisation = organisation;
    (req as AuthedRequest).userId = user.id;
    next();
  } catch (error) {
    console.error("Auth guard failed:", error);
    return httpError(res, 500, "Could not verify your session");
  }
}

function auth(req: Request): { organisation: Organisation; userId: number } {
  const authed = req as AuthedRequest;
  return { organisation: authed.organisation, userId: authed.userId };
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function publicOrganisation(org: Organisation) {
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    description: org.description,
    city: org.city,
    address: org.address,
    contactName: org.contactName,
    contactEmail: org.contactEmail,
    contactPhone: org.contactPhone,
    website: org.website,
    logoUrl: org.logoUrl,
    latitude: org.latitude,
    longitude: org.longitude,
    createdAt: org.createdAt,
  };
}

export function createOeuvreRouter(): Router {
  const router = Router();

  /* ------------------------------ meta ----------------------------- */

  router.get("/meta", (_req, res) => {
    res.json({
      organisationTypes: ORG_TYPES,
      categories: EQUIPMENT_CATEGORIES.map(({ value, label }) => ({ value, label })),
      conditions: CONDITIONS.map(({ value, label }) => ({ value, label })),
      bookingStatuses: BOOKING_STATUSES,
      eventTypes: EVENT_TYPES,
    });
  });

  /* ------------------------------ auth ----------------------------- */

  router.post("/auth/register", async (req, res) => {
    let payload: z.infer<typeof registerSchema>;
    try {
      payload = registerSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    try {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, payload.email))
        .limit(1);
      if (existing) {
        return httpError(res, 409, "An account already exists with this email", {
          fieldErrors: { email: "This email is already registered" },
        });
      }

      const password = await hashPassword(payload.password);

      const created = await db.transaction(async (tx) => {
        const [{ nextNumber }] = await tx
          .select({ nextNumber: sql<number>`coalesce(max(${users.userNumber}), 1000) + 1` })
          .from(users);

        const [organisation] = await tx
          .insert(organisations)
          .values({
            name: payload.organisationName,
            type: payload.organisationType,
            description: payload.description || null,
            contactName: payload.contactName,
            contactEmail: payload.email,
            contactPhone: payload.phone,
            address: payload.address,
            city: payload.city,
            pincode: payload.pincode || null,
            latitude: payload.latitude != null ? String(payload.latitude) : null,
            longitude: payload.longitude != null ? String(payload.longitude) : null,
            // Linked to the account created in the same transaction below.
            ownerUserId: 0,
          })
          .returning();

        const [user] = await tx
          .insert(users)
          .values({
            name: payload.contactName,
            email: payload.email,
            phone: payload.phone,
            password,
            city: payload.city,
            detailedAddress: payload.address,
            flatWing: null,
            buildingName: null,
            organisationId: organisation.id,
            role: "owner",
            userNumber: nextNumber,
          })
          .returning();

        const [linked] = await tx
          .update(organisations)
          .set({ ownerUserId: user.id })
          .where(eq(organisations.id, organisation.id))
          .returning();

        return { organisation: linked, user };
      });

      req.session.userId = created.user.id;
      req.session.save((error) => {
        if (error) {
          console.error("Session save failed:", error);
          return httpError(res, 500, "Account created, but the session could not start. Please sign in.");
        }
        return res.status(201).json({
          user: {
            id: created.user.id,
            name: created.user.name,
            email: created.user.email,
            phone: created.user.phone,
            role: created.user.role,
          },
          organisation: publicOrganisation(created.organisation),
        });
      });
    } catch (error) {
      console.error("Registration failed:", error);
      return httpError(res, 500, "Could not create your organisation account");
    }
  });

  router.post("/auth/login", async (req, res) => {
    let payload: z.infer<typeof loginSchema>;
    try {
      payload = loginSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, payload.email))
        .limit(1);
      if (!user) return httpError(res, 401, "Invalid email or password");

      const { match, needsRehash } = await comparePasswords(payload.password, user.password);
      if (!match) return httpError(res, 401, "Invalid email or password");

      if (needsRehash) {
        await db
          .update(users)
          .set({ password: await hashPassword(payload.password) })
          .where(eq(users.id, user.id));
      }

      const organisation = user.organisationId
        ? await store.getOrganisationById(user.organisationId)
        : undefined;

      req.session.userId = user.id;
      req.session.save((error) => {
        if (error) {
          console.error("Session save failed:", error);
          return httpError(res, 500, "Could not start a session. Please try again.");
        }
        return res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
          },
          organisation: organisation ? publicOrganisation(organisation) : null,
        });
      });
    } catch (error) {
      console.error("Login failed:", error);
      return httpError(res, 500, "Could not sign you in");
    }
  });

  router.post("/auth/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) return httpError(res, 500, "Could not sign out");
      res.clearCookie("connect.sid");
      return res.json({ message: "Signed out" });
    });
  });

  router.get("/auth/me", async (req, res) => {
    if (!req.session.userId) return httpError(res, 401, "Not signed in");

    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId)).limit(1);
    if (!user) return httpError(res, 401, "Not signed in");

    const organisation = user.organisationId
      ? await store.getOrganisationById(user.organisationId)
      : undefined;

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      organisation: organisation ? publicOrganisation(organisation) : null,
    });
  });

  /* ------------------------- organisation -------------------------- */

  router.get("/organisation", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const overview = await store.getOrganisationOverview(organisation.id);
    res.json(overview);
  });

  /** Create an organisation for a signed-in user who does not have one yet. */
  router.post("/organisation", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return httpError(res, 401, "Please sign in to continue");

    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return httpError(res, 401, "Please sign in again");
      if (user.organisationId) {
        return httpError(res, 409, "Your account already belongs to an organisation");
      }

      const body = registerSchema.omit({ email: true, password: true, contactName: true }).parse(req.body);
      const organisation = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(organisations)
          .values({
            name: body.organisationName,
            type: body.organisationType,
            description: body.description || null,
            contactName: user.name,
            contactEmail: user.email,
            contactPhone: body.phone,
            address: body.address,
            city: body.city,
            pincode: body.pincode || null,
            latitude: body.latitude != null ? String(body.latitude) : null,
            longitude: body.longitude != null ? String(body.longitude) : null,
            ownerUserId: user.id,
          })
          .returning();
        await tx.update(users).set({ organisationId: created.id, role: "owner" }).where(eq(users.id, user.id));
        return created;
      });

      return res.status(201).json({ organisation: publicOrganisation(organisation) });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      console.error("Organisation creation failed:", error);
      return httpError(res, 500, "Could not create your organisation");
    }
  });

  router.patch("/organisation", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    let patch: z.infer<typeof organisationPatchSchema>;
    try {
      patch = organisationPatchSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    const updated = await store.updateOrganisation(organisation.id, {
      ...patch,
      latitude: patch.latitude != null ? String(patch.latitude) : organisation.latitude,
      longitude: patch.longitude != null ? String(patch.longitude) : organisation.longitude,
    } as Partial<Organisation>);

    res.json({ organisation: updated ? publicOrganisation(updated) : null });
  });

  router.get("/organisations/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid organisation");

    const organisation = await store.getOrganisationById(id);
    if (!organisation) return httpError(res, 404, "Organisation not found");

    const listings = await store.listEquipmentByOrganisation(id);
    res.json({
      organisation: publicOrganisation(organisation),
      listings: listings.map((listing) => ({
        id: listing.id,
        name: listing.name,
        category: listing.category,
        condition: listing.condition,
        quantityTotal: listing.quantityTotal,
        quantityAvailable: listing.quantityAvailable,
        dailyRate: Number(listing.dailyRate),
        imageUrl: listing.imageUrl,
      })),
    });
  });

  /* ---------------------------- dashboard -------------------------- */

  router.get("/dashboard", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const overview = await store.getOrganisationOverview(organisation.id);
    const bookings = await store.listBookingsForOrganisation(organisation.id, "all");
    const equipmentList = await store.listEquipmentByOrganisation(organisation.id);

    const incomingPending = bookings.filter(
      (booking) => booking.ownerOrganisationId === organisation.id && booking.status === "pending",
    );
    const outgoingPending = bookings.filter(
      (booking) => booking.borrowerOrganisationId === organisation.id && booking.status === "pending",
    );
    const activeLoans = bookings.filter(
      (booking) => booking.status === "approved" &&
        (booking.ownerOrganisationId === organisation.id || booking.borrowerOrganisationId === organisation.id),
    );
    const awaitingReturnConfirmation = bookings.filter(
      (booking) => booking.ownerOrganisationId === organisation.id && booking.status === "returned" && !booking.returnConfirmedAt,
    );

    res.json({
      organisation: publicOrganisation(organisation),
      stats: {
        listings: overview?.stats.listings ?? 0,
        units: overview?.stats.units ?? 0,
        freeListings: overview?.stats.freeListings ?? 0,
        events: overview?.stats.events ?? 0,
        incomingPending: incomingPending.length,
        outgoingPending: outgoingPending.length,
        activeLoans: activeLoans.length,
        awaitingReturnConfirmation: awaitingReturnConfirmation.length,
        completedShares: bookings.filter(
          (booking) =>
            booking.status === "returned" &&
            (booking.ownerOrganisationId === organisation.id || booking.borrowerOrganisationId === organisation.id),
        ).length,
        availableUnits: equipmentList.reduce((sum, item) => sum + item.quantityAvailable, 0),
      },
      upcomingEvents: (overview?.events ?? []).slice(0, 3),
      recentBookings: bookings.slice(0, 5),
    });
  });

  /* ------------------------------ equipment ------------------------ */

  router.get("/equipment", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const includeInactive = req.query.includeInactive === "true";
    const items = await store.listEquipmentByOrganisation(organisation.id, { includeInactive });
    res.json({
      items: items.map((item) => ({ ...item, dailyRate: Number(item.dailyRate) })),
    });
  });

  const equipmentBodySchema = insertEquipmentSchema.extend({
    imageUrl: z.string().max(2_500_000).optional().nullable(),
  });

  router.post("/equipment", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    let body: z.infer<typeof equipmentBodySchema>;
    try {
      body = equipmentBodySchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    if (body.availabilityStart && body.availabilityEnd && body.availabilityStart > body.availabilityEnd) {
      return httpError(res, 400, "Available-from date must be before the available-until date", {
        fieldErrors: { availabilityEnd: "Must be after the start date" },
      });
    }

    const created = await store.createEquipment(organisation.id, {
      name: body.name,
      category: body.category,
      description: body.description ?? null,
      imageUrl: body.imageUrl ?? null,
      quantityTotal: body.quantityTotal,
      condition: body.condition ?? "good",
      dailyRate: Number(body.dailyRate).toFixed(2),
      availabilityStart: body.availabilityStart ?? null,
      availabilityEnd: body.availabilityEnd ?? null,
      pickupNotes: body.pickupNotes ?? null,
    });

    res.status(201).json({ item: { ...created, dailyRate: Number(created.dailyRate) } });
  });

  router.patch("/equipment/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid item");

    const existing = await store.getEquipmentById(id);
    if (!existing || existing.organisationId !== organisation.id) {
      return httpError(res, 404, "Item not found in your inventory");
    }

    let body: Partial<z.infer<typeof equipmentBodySchema>>;
    try {
      body = equipmentBodySchema.partial().parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    const patch: Record<string, unknown> = { ...body };
    if (body.dailyRate != null) patch.dailyRate = Number(body.dailyRate).toFixed(2);
    if (body.quantityTotal != null) {
      const booked = await store.bookedQuantities([id]);
      const used = booked.get(id) ?? 0;
      if (body.quantityTotal < used) {
        return httpError(
          res,
          409,
          `This item has ${used} approved units out on loan. Quantity cannot go below that.`,
          { fieldErrors: { quantityTotal: `At least ${used} required` } },
        );
      }
    }

    const updated = await store.updateEquipment(id, patch);
    res.json({ item: updated ? { ...updated, dailyRate: Number(updated.dailyRate) } : null });
  });

  router.delete("/equipment/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid item");

    const existing = await store.getEquipmentById(id);
    if (!existing || existing.organisationId !== organisation.id) {
      return httpError(res, 404, "Item not found in your inventory");
    }

    const hasHistory = await store.equipmentHasBookings(id);
    if (hasHistory) {
      await store.updateEquipment(id, { isActive: false });
      return res.json({ archived: true, message: "Listing archived — booking history is preserved" });
    }

    await store.deleteEquipment(id);
    return res.json({ archived: false, message: "Listing removed" });
  });

  router.get("/equipment/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid item");

    const listing = await store.getEquipmentById(id);
    if (!listing) return httpError(res, 404, "Listing not found");

    const organisation = await store.getOrganisationById(listing.organisationId);
    const booked = await store.bookedQuantities([id]);

    res.json({
      item: {
        ...listing,
        dailyRate: Number(listing.dailyRate),
        quantityBooked: booked.get(id) ?? 0,
        quantityAvailable: Math.max(0, listing.quantityTotal - (booked.get(id) ?? 0)),
      },
      organisation: organisation ? publicOrganisation(organisation) : null,
    });
  });

  /** Browse other organisations' inventory. */
  router.get("/market", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    const conditions = [eq(equipment.isActive, true), ne(equipment.organisationId, organisation.id)];
    if (category) conditions.push(eq(equipment.category, category));
    if (search) {
      conditions.push(
        or(
          sql`${equipment.name} ilike ${`%${search}%`}`,
          sql`coalesce(${equipment.description}, '') ilike ${`%${search}%`}`,
        )!,
      );
    }
    if (city) conditions.push(sql`${organisations.city} ilike ${`%${city}%`}`);

    const rows = await db
      .select({
        listing: equipment,
        organisationId: organisations.id,
        organisationName: organisations.name,
        organisationType: organisations.type,
        organisationCity: organisations.city,
      })
      .from(equipment)
      .innerJoin(organisations, eq(equipment.organisationId, organisations.id))
      .where(and(...conditions))
      .orderBy(desc(equipment.createdAt))
      .limit(120);

    const booked = await store.bookedQuantities(
      rows.map((row) => row.listing.id),
      startDate,
      endDate,
    );

    res.json({
      items: rows.map((row) => ({
        ...row.listing,
        dailyRate: Number(row.listing.dailyRate),
        quantityBooked: booked.get(row.listing.id) ?? 0,
        quantityAvailable: Math.max(0, row.listing.quantityTotal - (booked.get(row.listing.id) ?? 0)),
        organisation: {
          id: row.organisationId,
          name: row.organisationName,
          type: row.organisationType,
          city: row.organisationCity,
        },
      })),
    });
  });

  /* ------------------------------- events -------------------------- */

  router.get("/events", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const items = await store.listEventsByOrganisation(organisation.id);
    res.json({ items });
  });

  router.post("/events", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    let body: z.infer<typeof createEventWithRequirementsSchema>;
    try {
      body = createEventWithRequirementsSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    if (body.endDate < body.startDate) {
      return httpError(res, 400, "End date must be on or after the start date", {
        fieldErrors: { endDate: "Must be on or after the start date" },
      });
    }

    const created = await store.createEventWithRequirements(
      organisation.id,
      {
        name: body.name,
        eventType: body.eventType ?? "other",
        description: body.description ?? null,
        startDate: body.startDate,
        endDate: body.endDate,
        attendance: body.attendance,
        venue: body.venue || organisation.address,
        city: body.city,
        latitude: organisation.latitude,
        longitude: organisation.longitude,
        status: "planning",
      },
      body.requirements.map((requirement) => ({
        ...requirement,
        category: requirement.category ?? inferCategory(requirement.label),
      })),
    );

    res.status(201).json(created);
  });

  router.get("/events/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid event");

    const event = await store.getEventWithRequirements(id);
    if (!event || event.organisationId !== organisation.id) {
      return httpError(res, 404, "Event not found");
    }

    const eventBookings = (await store.listBookingsForOrganisation(organisation.id, "borrower"))
      .filter((booking) => booking.eventId === id);

    res.json({ event, bookings: eventBookings });
  });

  router.patch("/events/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid event");

    const existing = await store.getEventWithRequirements(id);
    if (!existing || existing.organisationId !== organisation.id) {
      return httpError(res, 404, "Event not found");
    }

    const patchSchema = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      eventType: z.string().trim().max(60).optional(),
      description: z.string().trim().max(1000).optional().nullable(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      attendance: z.coerce.number().int().min(0).max(1_000_000).optional(),
      venue: z.string().trim().max(200).optional().nullable(),
      city: z.string().trim().min(2).max(80).optional(),
      status: z.enum(["planning", "confirmed", "completed", "cancelled"]).optional(),
      requirements: z.array(insertEventRequirementSchema).max(30).optional(),
    });

    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    const { requirements, ...eventPatch } = body;
    const updated = await store.updateEvent(id, eventPatch);

    if (requirements) {
      await store.replaceEventRequirements(
        id,
        requirements.map((requirement) => ({
          ...requirement,
          category: requirement.category ?? inferCategory(requirement.label),
        })),
      );
    }

    const fresh = await store.getEventWithRequirements(id);
    res.json({ event: fresh ?? updated });
  });

  router.delete("/events/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid event");

    const existing = await store.getEventWithRequirements(id);
    if (!existing || existing.organisationId !== organisation.id) {
      return httpError(res, 404, "Event not found");
    }

    await store.deleteEvent(id);
    res.json({ message: "Event removed" });
  });

  /* ------------------------------ matching ------------------------- */

  router.get("/events/:id/matches", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid event");

    const event = await store.getEventWithRequirements(id);
    if (!event || event.organisationId !== organisation.id) {
      return httpError(res, 404, "Event not found");
    }
    if (event.requirements.length === 0) {
      return httpError(res, 409, "Add equipment requirements before matching");
    }

    const match = await store.matchEventInventory(
      event,
      event.requirements.map((requirement) => ({
        id: requirement.id,
        label: requirement.label,
        category: requirement.category,
        quantity: requirement.quantity,
      })),
    );

    res.json({ event, match });
  });

  /* ------------------------------ bookings ------------------------- */

  router.get("/bookings", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const roleParam = req.query.role;
    const role = roleParam === "borrower" || roleParam === "owner" ? roleParam : "all";
    const list = await store.listBookingsForOrganisation(organisation.id, role);

    const summary = {
      pending: list.filter((booking) => booking.status === "pending").length,
      approved: list.filter((booking) => booking.status === "approved").length,
      returned: list.filter((booking) => booking.status === "returned").length,
      awaitingConfirmation: list.filter(
        (booking) =>
          booking.ownerOrganisationId === organisation.id &&
          booking.status === "returned" &&
          !booking.returnConfirmedAt,
      ).length,
    };

    res.json({ bookings: list, summary, organisationId: organisation.id });
  });

  router.get("/bookings/:id", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const booking = await store.getBookingDetail(id);
    if (
      !booking ||
      (booking.borrowerOrganisationId !== organisation.id &&
        booking.ownerOrganisationId !== organisation.id)
    ) {
      return httpError(res, 404, "Booking not found");
    }

    res.json({ booking, organisationId: organisation.id });
  });

  router.post("/bookings", requireOrganisation, async (req, res) => {
    const { organisation, userId } = auth(req);
    let body: z.infer<typeof createBookingSchema>;
    try {
      body = createBookingSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(res, error);
      throw error;
    }

    const event = await store.getEventWithRequirements(body.eventId);
    if (!event || event.organisationId !== organisation.id) {
      return httpError(res, 404, "Event not found");
    }
    if (event.status === "cancelled" || event.status === "completed") {
      return httpError(res, 409, "This event is closed for new requests");
    }

    const result = await store.createBookingRequests(
      organisation,
      userId,
      event,
      body.items,
      body.message,
    );

    if (!result.ok) return httpError(res, result.status, result.error);

    const created = await Promise.all(result.bookingIds.map((id) => store.getBookingDetail(id)));
    res.status(201).json({
      bookings: created.filter(Boolean),
      message:
        result.bookingIds.length === 1
          ? "Request sent to the equipment owner"
          : `${result.bookingIds.length} requests sent to equipment owners`,
    });
  });

  router.post("/bookings/:id/approve", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    const result = await store.approveBooking(id, organisation.id, note);
    if (!result.ok) return httpError(res, result.status, result.error);
    return res.json({ booking: result.booking, message: "Booking approved" });
  });

  router.post("/bookings/:id/reject", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    const result = await store.rejectBooking(id, organisation.id, note);
    if (!result.ok) return httpError(res, result.status, result.error);
    return res.json({ booking: result.booking, message: "Request declined" });
  });

  router.post("/bookings/:id/cancel", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const result = await store.cancelBooking(id, organisation.id);
    if (!result.ok) return httpError(res, result.status, result.error);
    return res.json({ booking: result.booking, message: "Booking cancelled" });
  });

  router.post("/bookings/:id/return", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const purchaseAvoided = req.body?.purchaseAvoided === true;
    const result = await store.markBookingReturned(id, organisation.id, purchaseAvoided);
    if (!result.ok) return httpError(res, result.status, result.error);
    return res.json({
      booking: result.booking,
      message: "Marked as returned. The owner will confirm receipt.",
    });
  });

  router.post("/bookings/:id/confirm-return", requireOrganisation, async (req, res) => {
    const { organisation } = auth(req);
    const id = parseId(req.params.id);
    if (!id) return httpError(res, 400, "Invalid booking");

    const result = await store.confirmBookingReturn(id, organisation.id);
    if (!result.ok) return httpError(res, result.status, result.error);
    return res.json({ booking: result.booking, message: "Return confirmed" });
  });

  /* --------------------------- notifications ----------------------- */

  router.get("/notifications", requireOrganisation, async (req, res) => {
    const { userId } = auth(req);
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: rows, unread: rows.filter((row) => !row.isRead).length });
  });

  router.post("/notifications/read", requireOrganisation, async (req, res) => {
    const { userId } = auth(req);
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
    res.json({ message: "Notifications marked as read" });
  });

  /* ------------------------------- impact -------------------------- */

  router.get("/impact", async (_req, res) => {
    const stats = await store.getImpactStats();
    res.json(stats);
  });

  return router;
}
