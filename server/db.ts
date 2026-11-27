import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
const isLocal = /(^|@)(localhost|127\.0\.0\.1|::1)(:|\/)/.test(connectionString);

/**
 * Standard PostgreSQL pool. Works with any managed Postgres (Neon, Supabase,
 * RDS, ...) as well as a local server for development.
 */
export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // Serverless instances are short-lived and many can run at once, so keep
  // each instance's pool small when running on Vercel.
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  application_name: "oeuvre",
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected database pool error:', err.message);
});

export const db = drizzle(pool, { schema });

/** True when the database is reachable; used by the readiness endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    // Never log the connection string; the driver message is enough.
    console.error('Database ping failed:', (error as Error).message);
    return false;
  }
}
