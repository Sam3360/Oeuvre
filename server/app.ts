/**
 * The Oeuvre Express application.
 *
 * This is the API only: no Vite dev server and no static file serving. The
 * local server entry (server/index.ts) wraps this app, and the Vercel
 * serverless function loads the bundled version of it.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import { createOeuvreRouter } from "./oeuvre/routes";
import { log } from "./log";
import { ensureDatabaseSchema } from "./schema";
import PostgresStore from "connect-pg-simple";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Every request that reaches the domain API needs the tables to exist. The
// bootstrap is idempotent and cached per process, so this costs one round trip
// on a cold start and nothing afterwards.
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  // Only the domain API touches these tables. Health checks the database
  // itself, and unknown paths must answer without a database round trip.
  if (!req.path.startsWith("/api/oeuvre")) return next();
  try {
    await ensureDatabaseSchema();
    next();
  } catch (error) {
    next(error);
  }
});

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.warn("SESSION_SECRET is not set; sessions will not survive a restart");
}

app.use(
  "/api",
  session({
    name: "connect.sid",
    secret: sessionSecret ?? "oeuvre-dev-session-secret",
    resave: false,
    saveUninitialized: false,
    store: new PostgresStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }),
);

app.get("/api/health", async (_req: Request, res: Response) => {
  const { pingDatabase } = await import("./db");
  const database = await pingDatabase();
  res.status(database ? 200 : 503).json({
    ok: database,
    database,
    service: "oeuvre",
    schema: database ? "ready" : "unknown",
  });
});

app.use("/api/oeuvre", createOeuvreRouter());

// Anything else under /api is a JSON 404. Without this, Express answers with
// its HTML error page, which makes API clients try to parse markup as JSON.
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ message: `No API route for ${req.method} ${req.originalUrl}` });
});

app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error("Unhandled API error:", err);
  res.status(status).json({ message: err.message || "Internal server error" });
});

log("Oeuvre API ready");

export default app;
