/**
 * Regression tests for the production outage.
 *
 * The deployed function used to fail before Express could serve a request
 * because it loaded a separately-built bundle whose npm dependencies were not
 * part of the function. These tests run the real build output from a directory
 * with no node_modules, which is what the serverless runtime provides.
 *
 * Run with `npm test` (uses the `npm run build:api` output in dist/).
 */
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Point at a closed port so the database ping fails deterministically; dotenv
// does not override values that already exist.
process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:1/oeuvre_test";
process.env.SESSION_SECRET = "regression-test-secret";

const root = resolve(import.meta.dirname, "..");
const bundle = join(root, "dist", "api.cjs");

function lambdaDir({ withBundle = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "oeuvre-lambda-"));
  cpSync(join(root, "api"), join(dir, "api"), { recursive: true });
  if (withBundle) cpSync(bundle, join(dir, "dist", "api.cjs"));
  writeFileSync(join(dir, "package.json"), '{"type":"module"}');
  return dir;
}

async function requestFrom(dir, path = "/api/health") {
  const { default: handler } = await import(
    pathToFileURL(join(dir, "api", "index.js")).href + `?t=${Date.now()}`
  );
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: response.status, headers: response.headers, body };
  } finally {
    await new Promise((done) => server.close(done));
  }
}

test("the API bundle no longer pulls in the dev-only Vite graph", () => {
  const source = readFileSync(bundle, "utf8");
  assert.equal(source.includes("@vitejs/plugin-react"), false, "bundle must not include @vitejs/plugin-react");
  assert.equal(source.includes("node_modules/vite/"), false, "bundle must not include vite");
});

test("the function starts with no node_modules beside it", async () => {
  const { status, body } = await requestFrom(lambdaDir());
  assert.equal(body.service, "oeuvre", "Express must load and answer /api/health");
  assert.equal(body.database, false, "the health route reports the failed database ping");
  assert.equal(status, 503, "health is unhealthy while the database is unreachable");
  assert.ok(body.schema !== undefined, "the health route also reports schema status");
  assert.equal("code" in body, false, "the app answered, so the entry point did not fall back to its 503");
});

test("an unknown API path returns JSON, never Express's HTML error page", async () => {
  const { status, headers, body } = await requestFrom(lambdaDir(), "/api/not-a-route");
  assert.equal(status, 404);
  assert.match(headers.get("content-type") ?? "", /application\/json/);
  assert.equal(typeof body.message, "string");
});

test("the entry point reports a diagnostic code instead of hanging when the bundle is absent", async () => {
  const { status, headers, body } = await requestFrom(lambdaDir({ withBundle: false }));
  assert.equal(status, 503);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(typeof body.code, "string");
});
