/**
 * Oeuvre schema.
 *
 * Only the account table and notifications live here; the sharing domain
 * (organisations, equipment, events, requirements, bookings) is in
 * ./oeuvre-schema and re-exported below so callers import from one place.
 */
import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  flatWing: text("flat_wing"),
  buildingName: text("building_name"),
  detailedAddress: text("detailed_address"),
  city: text("city").notNull(),
  // A user belongs to exactly one organisation.
  organisationId: integer("organisation_id"),
  role: text("role").default("owner").notNull(),
  userNumber: integer("user_number").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull(),
    data: text("data"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export * from "./oeuvre-schema";
