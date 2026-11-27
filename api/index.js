// Vercel serverless entry point.
//
// `npm run build:api` compiles server/app.ts into dist/api.cjs with every
// dependency inlined, so this function needs nothing else from the filesystem
// except that one file (see `functions.includeFiles` in vercel.json). Keeping
// the app in a single self-contained bundle avoids relying on node_modules
// being present in the function, which is what broke the previous deployment.
const API_BUILD = "oeuvre-api-2";

let appPromise;

/** Vercel may hand us the path without the /api mount; Express expects it. */
function normalizeUrl(req) {
  const url = typeof req.url === "string" && req.url ? req.url : "/";
  if (url === "/api" || url.startsWith("/api/") || url.startsWith("/api?")) {
    req.url = url;
  } else {
    req.url = url.startsWith("/") ? `/api${url}` : `/api/${url}`;
  }
}

export default async function handler(req, res) {
  try {
    appPromise ??= import("../dist/api.cjs").then(
      (module) => module.default?.default ?? module.default,
    );
    const app = await appPromise;
    normalizeUrl(req);
    return app(req, res);
  } catch (error) {
    console.error("API initialization failed:", error);
    appPromise = undefined;
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Oeuvre-Api", API_BUILD);
      res.end(
        JSON.stringify({
          message: "The server could not start. Please try again shortly.",
          code: (error && (error.code || error.name)) || "UNKNOWN",
        }),
      );
    }
  }
}
