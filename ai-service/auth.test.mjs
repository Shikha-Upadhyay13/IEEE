import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { verifyRequest, clearAuthCache } from "./auth.mjs";

const config = { supabaseUrl: "https://example.supabase.co", anonKey: "anon", disabled: false };
const req = (authorization) => ({ headers: authorization ? { authorization } : {} });

function fakeFetch(status, body) {
  let calls = 0;
  const fn = async () => {
    calls += 1;
    return { status, ok: status >= 200 && status < 300, json: async () => body };
  };
  fn.calls = () => calls;
  return fn;
}

beforeEach(() => clearAuthCache());

test("rejects a request without a bearer token", async () => {
  const result = await verifyRequest(req(), config, fakeFetch(200, { id: "u1" }));
  assert.deepEqual(result, { ok: false, status: 401, error: "Sign in to use AI features." });
});

test("accepts a token Supabase recognises and caches it", async () => {
  const fetch = fakeFetch(200, { id: "u1" });
  assert.deepEqual(await verifyRequest(req("Bearer abc"), config, fetch), { ok: true, userId: "u1" });
  assert.deepEqual(await verifyRequest(req("Bearer abc"), config, fetch), { ok: true, userId: "u1" });
  assert.equal(fetch.calls(), 1);
});

test("rejects an expired or forged token", async () => {
  const result = await verifyRequest(req("Bearer bad"), config, fakeFetch(401, {}));
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("fails closed when auth is not configured", async () => {
  const result = await verifyRequest(req("Bearer abc"), { supabaseUrl: "", anonKey: "", disabled: false });
  assert.equal(result.status, 503);
});

test("can be disabled explicitly for local development", async () => {
  const result = await verifyRequest(req(), { ...config, disabled: true });
  assert.deepEqual(result, { ok: true, userId: null });
});
