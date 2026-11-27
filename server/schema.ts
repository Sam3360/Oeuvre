/**
 * Idempotent database bootstrap.
 *
 * The deployed database may be brand new (an empty Supabase project) or may
 * already contain Oeuvre tables. Every statement below is safe to repeat and
 * never drops or rewrites existing rows, so it can run on every cold start:
 * missing tables and indexes are created, present ones are left untouched.
 */
import { pool } from "./db";

type TableSpec = {
  table: string;
  create: string;
  indexes?: string[];
  columns: string[];
};

const TABLES: TableSpec[] = [
  {
    table: "users",
    columns: [
      "id",
      "name",
      "email",
      "phone",
      "password",
      "flat_wing",
      "building_name",
      "detailed_address",
      "city",
      "organisation_id",
      "role",
      "user_number",
      "created_at",
    ],
    create: `
      CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "email" text NOT NULL UNIQUE,
        "phone" text NOT NULL,
        "password" text NOT NULL,
        "flat_wing" text,
        "building_name" text,
        "detailed_address" text,
        "city" text NOT NULL,
        "organisation_id" integer,
        "role" text NOT NULL DEFAULT 'owner',
        "user_number" integer NOT NULL UNIQUE,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
  },
  {
    table: "organisations",
    columns: [
      "id",
      "name",
      "type",
      "description",
      "contact_name",
      "contact_email",
      "contact_phone",
      "address",
      "city",
      "pincode",
      "latitude",
      "longitude",
      "website",
      "logo_url",
      "owner_user_id",
      "created_at",
    ],
    create: `
      CREATE TABLE IF NOT EXISTS "organisations" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL,
        "type" text NOT NULL DEFAULT 'other',
        "description" text,
        "contact_name" text NOT NULL,
        "contact_email" text NOT NULL,
        "contact_phone" text NOT NULL,
        "address" text NOT NULL,
        "city" text NOT NULL,
        "pincode" text,
        "latitude" numeric(10, 7),
        "longitude" numeric(10, 7),
        "website" text,
        "logo_url" text,
        "owner_user_id" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [`CREATE INDEX IF NOT EXISTS "organisations_city_idx" ON "organisations" ("city")`],
  },
  {
    table: "equipment",
    columns: [
      "id",
      "organisation_id",
      "name",
      "category",
      "description",
      "image_url",
      "quantity_total",
      "condition",
      "daily_rate",
      "availability_start",
      "availability_end",
      "pickup_notes",
      "is_active",
      "created_at",
      "updated_at",
    ],
    create: `
      CREATE TABLE IF NOT EXISTS "equipment" (
        "id" serial PRIMARY KEY,
        "organisation_id" integer NOT NULL,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "description" text,
        "image_url" text,
        "quantity_total" integer NOT NULL DEFAULT 1,
        "condition" text NOT NULL DEFAULT 'good',
        "daily_rate" numeric(10, 2) NOT NULL DEFAULT 0,
        "availability_start" date,
        "availability_end" date,
        "pickup_notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS "equipment_organisation_idx" ON "equipment" ("organisation_id")`,
      `CREATE INDEX IF NOT EXISTS "equipment_category_idx" ON "equipment" ("category")`,
    ],
  },
  {
    table: "events",
    columns: [
      "id",
      "organisation_id",
      "name",
      "event_type",
      "description",
      "start_date",
      "end_date",
      "attendance",
      "venue",
      "city",
      "latitude",
      "longitude",
      "status",
      "created_at",
    ],
    create: `
      CREATE TABLE IF NOT EXISTS "events" (
        "id" serial PRIMARY KEY,
        "organisation_id" integer NOT NULL,
        "name" text NOT NULL,
        "event_type" text NOT NULL DEFAULT 'other',
        "description" text,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "attendance" integer NOT NULL DEFAULT 0,
        "venue" text,
        "city" text NOT NULL,
        "latitude" numeric(10, 7),
        "longitude" numeric(10, 7),
        "status" text NOT NULL DEFAULT 'planning',
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS "events_organisation_idx" ON "events" ("organisation_id")`,
      `CREATE INDEX IF NOT EXISTS "events_start_date_idx" ON "events" ("start_date")`,
    ],
  },
  {
    table: "event_requirements",
    columns: ["id", "event_id", "label", "category", "quantity", "notes", "created_at"],
    create: `
      CREATE TABLE IF NOT EXISTS "event_requirements" (
        "id" serial PRIMARY KEY,
        "event_id" integer NOT NULL,
        "label" text NOT NULL,
        "category" text NOT NULL DEFAULT 'other',
        "quantity" integer NOT NULL DEFAULT 1,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS "event_requirements_event_idx" ON "event_requirements" ("event_id")`,
    ],
  },
  {
    table: "bookings",
    columns: [
      "id",
      "event_id",
      "equipment_id",
      "borrower_organisation_id",
      "owner_organisation_id",
      "requested_by_user_id",
      "quantity",
      "start_date",
      "end_date",
      "daily_rate",
      "total_cost",
      "status",
      "message",
      "response_note",
      "purchase_avoided",
      "decided_at",
      "returned_at",
      "return_confirmed_at",
      "created_at",
    ],
    create: `
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" serial PRIMARY KEY,
        "event_id" integer NOT NULL,
        "equipment_id" integer NOT NULL,
        "borrower_organisation_id" integer NOT NULL,
        "owner_organisation_id" integer NOT NULL,
        "requested_by_user_id" integer NOT NULL,
        "quantity" integer NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "daily_rate" numeric(10, 2) NOT NULL DEFAULT 0,
        "total_cost" numeric(10, 2) NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "message" text,
        "response_note" text,
        "purchase_avoided" boolean NOT NULL DEFAULT false,
        "decided_at" timestamp,
        "returned_at" timestamp,
        "return_confirmed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS "bookings_equipment_status_idx" ON "bookings" ("equipment_id", "status")`,
      `CREATE INDEX IF NOT EXISTS "bookings_borrower_idx" ON "bookings" ("borrower_organisation_id")`,
      `CREATE INDEX IF NOT EXISTS "bookings_owner_idx" ON "bookings" ("owner_organisation_id")`,
      `CREATE INDEX IF NOT EXISTS "bookings_event_idx" ON "bookings" ("event_id")`,
    ],
  },
  {
    table: "notifications",
    columns: ["id", "user_id", "title", "message", "type", "data", "is_read", "created_at"],
    create: `
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "type" text NOT NULL,
        "data" text,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      )`,
    indexes: [
      `CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id", "created_at")`,
    ],
  },
  {
    table: "sessions",
    columns: ["sid", "sess", "expire"],
    // Same layout connect-pg-simple ships in table.sql, with the table name the
    // session store is configured with.
    create: `
      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      )`,
    indexes: [`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire")`],
  },
];

async function applySchema(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const spec of TABLES) {
      await client.query(spec.create);
      for (const statement of spec.indexes ?? []) {
        await client.query(statement);
      }
    }
  } finally {
    client.release();
  }
}

export type SchemaStatus = {
  ready: boolean;
  missingTables: string[];
  missingColumns: string[];
};

/** Reports which tables/columns the live database is missing. */
export async function getSchemaStatus(): Promise<SchemaStatus> {
  const tables = TABLES.map((spec) => spec.table);
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])`,
    [tables],
  );

  const present = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!present.has(row.table_name)) present.set(row.table_name, new Set());
    present.get(row.table_name)!.add(row.column_name);
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const spec of TABLES) {
    const columns = present.get(spec.table);
    if (!columns) {
      missingTables.push(spec.table);
      continue;
    }
    for (const column of spec.columns) {
      if (!columns.has(column)) missingColumns.push(`${spec.table}.${column}`);
    }
  }

  return { ready: missingTables.length === 0 && missingColumns.length === 0, missingTables, missingColumns };
}

let schemaPromise: Promise<void> | null = null;

/**
 * Ensures the schema exists. The first call runs the DDL; later calls reuse
 * the resolved promise. A failure clears the cache so the next request retries
 * instead of leaving the instance permanently broken.
 */
export function ensureDatabaseSchema(): Promise<void> {
  schemaPromise ??= applySchema().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}
