import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import { createOeuvreRouter } from "./oeuvre/routes";
import { serveStatic, log } from "./static";
import { pool, pingDatabase } from "./db";
import PostgresStore from "connect-pg-simple";

const PostgresSessionStore = PostgresStore(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);

// Inventory photos are stored as compressed data URLs, so allow large bodies.
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ limit: "12mb", extended: true }));

if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️  SESSION_SECRET is not set — set it before deploying to production.");
  }
}

const sessionMiddleware = session({
  name: "oeuvre.sid",
  store: new PostgresSessionStore({
    pool,
    createTableIfMissing: true,
    tableName: "sessions",
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
  res.status(database ? 200 : 503).json({ ok: database, database, service: "oeuvre" });
});

app.use("/api/oeuvre", createOeuvreRouter());

app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  console.error("Unhandled API error:", err);
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  serveStatic(app);
} else {
  (async () => {
    try {
      const { createServer } = await import("http");
      const server = createServer(app);
      const { setupVite } = await import("./vite");
      await setupVite(app, server);

      const port = process.env.PORT ? parseInt(process.env.PORT) : 5001;

      server.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") {
          console.error(`❌ Port ${port} is already in use.`);
        } else {
          console.error("❌ Server error:", error);
        }
        process.exit(1);
      });

      server.listen(port, "0.0.0.0", () => {
        log(`Oeuvre running on http://localhost:${port}`);
      });

      const shutdown = (signal: string) => {
        log(`\n👋 ${signal} received. Shutting down…`);
        if (typeof (server as unknown as { closeAllConnections?: () => void }).closeAllConnections === "function") {
          (server as unknown as { closeAllConnections: () => void }).closeAllConnections();
        }
        server.close(async () => {
          try {
            await pool.end();
          } finally {
            process.exit(0);
          }
        });
        setTimeout(() => process.exit(1), 5000);
      };

      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      process.exit(1);
    }
  })();
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

export default app;
