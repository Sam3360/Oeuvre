import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./log";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export { log };

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    if (process.env.VERCEL) {
      log(`Static directory not found at ${distPath}, skipping serveStatic as Vercel handles routing.`, "static");
      return;
    }
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
