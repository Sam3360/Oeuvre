/**
 * Regression tests for the production outage.
 *
 * The deployed function failed at cold start because it imported a bundle whose
 * dependencies were not traced into the function. These tests load the real
 * serverless entry point with no node_modules present, which is what the
 * production runtime provides.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Point the database at a closed port so the API cannot reach it during tests.
process.env.DATABASE_URL = "postgresql://oeuvre:oeuvre@127.0.0.1:1/oeuvre_test";

const ROOT = new URL("..", import.meta.url).pathname;

function lambdaDir({ withBundle = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "oeuvre-lambda-"));
  cpSync(join(ROOT, "api"), join(dir, "api"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "commonjs" }));
  if (withBundle) {
    cpSync(join(ROOT, "dist"), join(dir, "dist"), { recursive: true });
  }
  return dir;
}

async function requestFrom(dir, path = "/api/health") {
  const mod = await import(pathToFileURL(join(dir, "api", "index.js")).href);
  const handler = mod.default;
  const req = {
    method: "GET",
    url: path,
    headers: { host: "localhost" },
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
  };
  const chunks = [];
  let statusCode = 200;
  const headers = {};
  const res = {
    get headersSent() {
      return false;
    },
    set statusCode(value) {
      statusCode = value;
    },
    get statusCode() {
      return statusCode;
    },
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    end(body) {
      if (body) chunks.push(body);
    },
    write(body) {
      if (body) chunks.push(body);
    },
    on() {},
    once() {},
    removeListener() {},
  };
  await handler(req, res);
  const text = chunks.join("");
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: statusCode, headers, body };
}

test("the API bundle no longer includes the dev-only Vite server", async () => {
  const dir = lambdaDir();
  const { readFileSync } = await import("node:fs");
  const bundle = readFileSync(join(dir, "dist", "api.cjs"), "utf8");
  assert.equal(bundle.includes("createServer as createViteServer"), false);
  assert.equal(bundle.includes("vite:config"), false);
});

test("the function starts with no node_modules beside it", async () => {
  const { status, body } = await requestFrom(lambdaDir());
  assert.equal(body.service, "oeuvre", "Express must load and answer /api/health");
  assert.equal(body.database, false, "the health route reports the failed database ping");
  assert.equal(status, 503, "health is unhealthy when the database is unreachable");
  assert.ok(body.schema, "the health route also reports schema state");
  assert.equal("code" in body, false, "the app answered, so the entry point did not fall back to its 503");
});

test("an unknown API path returns JSON, never Express's HTML error page", async () => {
  const { status, headers, body } = await requestFrom(lambdaDir(), "/api/not-a-route");
  assert.equal(status, 404);
  assert.match(headers["content-type"] ?? "", /application\/json/);
  assert.equal(typeof body.message, "string");
});

test("the entry point reports a diagnostic code instead of hanging when the bundle is absent", async () => {
  const { status, headers, body } = await requestFrom(lambdaDir({ withBundle: false }));
  assert.equal(status, 503);
  assert.match(headers["content-type"] ?? "", /application\/json/);
  assert.equal(typeof body.code, "string");
});
