/**
 * Oeuvre data model (organisations, inventory, events, bookings).
 *
 * These tables are added alongside the original schema; nothing existing is
 * dropped. Bookings are the source of truth for availability: available stock
 * is always derived from total quantity minus approved bookings that overlap
 * the requested dates.
 */
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  decimal,
  date,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organisations = pgTable(
  "organisations",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").notNull().default("other"),
    description: text("description"),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    pincode: text("pincode"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    website: text("website"),
    logoUrl: text("logo_url"),
    ownerUserId: integer("owner_user_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    cityIdx: index("organisations_city_idx").on(table.city),
  }),
);

export const equipment = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisation_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    quantityTotal: integer("quantity_total").notNull().default(1),
    condition: text("condition").notNull().default("good"),
    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    availabilityStart: date("availability_start"),
    availabilityEnd: date("availability_end"),
    pickupNotes: text("pickup_notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("equipment_organisation_idx").on(table.organisationId),
    categoryIdx: index("equipment_category_idx").on(table.category),
  }),
);

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    organisationId: integer("organisation_id").notNull(),
    name: text("name").notNull(),
    eventType: text("event_type").notNull().default("other"),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    attendance: integer("attendance").notNull().default(0),
    venue: text("venue"),
    city: text("city").notNull(),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    status: text("status").notNull().default("planning"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("events_organisation_idx").on(table.organisationId),
    dateIdx: index("events_start_date_idx").on(table.startDate),
  }),
);

export const eventRequirements = pgTable(
  "event_requirements",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull().default("other"),
    quantity: integer("quantity").notNull().default(1),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    eventIdx: index("event_requirements_event_idx").on(table.eventId),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    equipmentId: integer("equipment_id").notNull(),
    borrowerOrganisationId: integer("borrower_organisation_id").notNull(),
    ownerOrganisationId: integer("owner_organisation_id").notNull(),
    requestedByUserId: integer("requested_by_user_id").notNull(),
    quantity: integer("quantity").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }).notNull().default("0"),
    totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("pending"),
    message: text("message"),
    responseNote: text("response_note"),
    /** Borrower confirms the purchase this booking replaced was avoided. */
    purchaseAvoided: boolean("purchase_avoided").default(false).notNull(),
    decidedAt: timestamp("decided_at"),
    returnedAt: timestamp("returned_at"),
    returnConfirmedAt: timestamp("return_confirmed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    equipmentStatusIdx: index("bookings_equipment_status_idx").on(table.equipmentId, table.status),
    borrowerIdx: index("bookings_borrower_idx").on(table.borrowerOrganisationId),
    ownerIdx: index("bookings_owner_idx").on(table.ownerOrganisationId),
    eventIdx: index("bookings_event_idx").on(table.eventId),
  }),
);

/* ------------------------------------------------------------------ */
/* Validation schemas                                                  */
/* ------------------------------------------------------------------ */

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD date format");

export const insertOrganisationSchema = createInsertSchema(organisations, {
  name: z.string().trim().min(2, "Organisation name is required").max(120),
  contactName: z.string().trim().min(2, "Contact name is required").max(120),
  contactEmail: z.string().trim().email("Enter a valid email"),
  contactPhone: z.string().trim().min(8, "Enter a valid phone number").max(20),
  address: z.string().trim().min(5, "Address is required").max(500),
  city: z.string().trim().min(2, "City is required").max(80),
  description: z.string().trim().max(1000).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
}).omit({ id: true, createdAt: true, ownerUserId: true, logoUrl: true });

export const insertEquipmentSchema = createInsertSchema(equipment, {
  name: z.string().trim().min(2, "Item name is required").max(120),
  quantityTotal: z.coerce.number().int().min(1, "Quantity must be at least 1").max(100000),
  dailyRate: z.coerce.number().min(0, "Cost cannot be negative").max(1_000_000),
  description: z.string().trim().max(1000).optional().nullable(),
  pickupNotes: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().max(2_500_000).optional().nullable(),
  availabilityStart: dateString.optional().nullable(),
  availabilityEnd: dateString.optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true, organisationId: true });

export const insertEventSchema = createInsertSchema(events, {
  name: z.string().trim().min(2, "Event name is required").max(120),
  startDate: dateString,
  endDate: dateString,
  attendance: z.coerce.number().int().min(0).max(1_000_000),
  city: z.string().trim().min(2, "City is required").max(80),
  venue: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
}).omit({ id: true, createdAt: true, organisationId: true });

export const insertEventRequirementSchema = createInsertSchema(eventRequirements, {
  label: z.string().trim().min(2, "Name the equipment you need").max(120),
  quantity: z.coerce.number().int().min(1).max(100000),
  notes: z.string().trim().max(500).optional().nullable(),
}).omit({ id: true, createdAt: true, eventId: true });

export const createEventWithRequirementsSchema = insertEventSchema.extend({
  requirements: z.array(insertEventRequirementSchema).min(1, "Add at least one equipment requirement").max(30),
});

export const createBookingSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        equipmentId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(100000),
      }),
    )
    .min(1, "Select at least one item"),
  message: z.string().trim().max(1000).optional(),
});

export const bookingDecisionSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export type Organisation = typeof organisations.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Event = typeof events.$inferSelect;
export type EventRequirement = typeof eventRequirements.$inferSelect;
export type Booking = typeof bookings.$inferSelect;

export type CreateEventInput = z.infer<typeof createEventWithRequirementsSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type OrganisationInput = z.infer<typeof insertOrganisationSchema>;
export type EquipmentInput = z.infer<typeof insertEquipmentSchema>;
