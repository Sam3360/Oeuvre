/**
 * Local server entry point.
 *
 * The API itself lives in `server/app.ts`; this file only starts the HTTP
 * server for local development and `npm start`, or attaches static serving for
 * a production Node run. Vercel never executes this file: it runs the bundled
 * `api/index.js` function instead, and serves the built client itself.
 */
import app from "./app";
import { pool } from "./db";
import { log } from "./log";

const isServerless = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === "production";

async function startLocalServer(): Promise<void> {
  if (isProduction) {
    const { serveStatic } = await import("./static");
    serveStatic(app);
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;
    app.listen(port, "0.0.0.0", () => log(`Oeuvre running on http://localhost:${port}`));
    return;
  }

  const { createServer } = await import("http");
  const server = createServer(app);
  const { setupVite } = await import("./vite");
  await setupVite(app, server);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5001;

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
}

if (!isServerless) {
  startLocalServer().catch((error) => {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  });

  // The serverless runtime must not exit the instance on a stray rejection.
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
  });
}

export default app;
