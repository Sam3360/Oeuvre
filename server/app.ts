/**
 * The Oeuvre Express application.
 *
 * This module builds the API only: it has no dev server, no Vite import and no
 * filesystem static serving, so it can be bundled on its own for the Vercel
 * serverless function (see ../api/index.js). `server/index.ts` adds the local
 * dev/static server around it.
 */
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { createOeuvreRouter } from "./oeuvre/routes";
import { log } from "./log";
import { pool, pingDatabase } from "./db";
import { ensureDatabaseSchema, getSchemaStatus } from "./schema";
import PostgresStore from "connect-pg-simple";

const PostgresSessionStore = PostgresStore(session);

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Inventory photos are stored as compressed data URLs, so allow large bodies.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ limit: "12mb", extended: true }));

if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  console.warn("⚠️  SESSION_SECRET is not set — sessions will not survive a restart.");
}

// The session store needs its table, and the API needs every domain table, so
// make sure the schema exists before the first request touches the database.
// This is idempotent (CREATE ... IF NOT EXISTS) and cached per process, which
// makes a fresh database work without a manual migration step.
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  // /api/health reports database and schema state itself, so it must be able
  // to answer even when the database is down.
  if (!req.path.startsWith("/api") || req.path === "/api/health") return next();
  try {
    await ensureDatabaseSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const sessionMiddleware = session({
  // Matches the cookie the logout route clears, so signing out actually
  // removes the browser's session cookie.
  name: "connect.sid",
  store: new PostgresSessionStore({
    pool,
    tableName: "sessions",
    // The table is created by `ensureDatabaseSchema`; connect-pg-simple reads
    // its DDL from disk, which does not exist inside a bundled function.
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || "oeuvre-local-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
});
app.use("/api", sessionMiddleware);
app.set("sessionMiddleware", sessionMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson: unknown, ...args: unknown[]) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return (originalResJson as (...a: unknown[]) => Response)(bodyJson, ...args);
  } as typeof res.json;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine.length > 160 ? `${logLine.slice(0, 159)}…` : logLine);
    }
  });

  next();
});

app.get("/api/health", async (_req, res) => {
  const database = await pingDatabase();
  let schemaReady = false;
  let missing: string[] = [];
  if (database) {
    try {
      const status = await getSchemaStatus();
      schemaReady = status.ready;
      missing = [...status.missingTables, ...status.missingColumns];
    } catch (error) {
      console.error("Schema check failed:", (error as Error).message);
    }
  }
  const ok = database && schemaReady;
  res.status(ok ? 200 : 503).json({
    ok,
    database,
    schema: schemaReady ? "ready" : missing.length ? missing : "unknown",
    service: "oeuvre",
  });
});

app.use("/api/oeuvre", createOeuvreRouter());

app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  console.error("Unhandled API error:", err);
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

export default app;
