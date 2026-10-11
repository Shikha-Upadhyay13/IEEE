import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { HttpError, isExportTokenValid, parseExportRequest, readBody } from "./exportRequest.mjs";

const DOC = "3f1c2b9a-1d2e-4f5a-8b7c-0123456789ab";
const TOKEN = "9a8b7c6d-1d2e-4f5a-8b7c-0123456789ab";

test("parseExportRequest accepts UUIDs", () => {
  assert.deepEqual(parseExportRequest(JSON.stringify({ documentId: DOC, token: TOKEN })), {
    documentId: DOC,
    token: TOKEN,
  });
});

test("parseExportRequest rejects ids that could change the render URL", () => {
  for (const documentId of ["../admin", `${DOC}?x=1`, "", 42]) {
    assert.throws(
      () => parseExportRequest(JSON.stringify({ documentId, token: TOKEN })),
      (err) => err instanceof HttpError && err.status === 400
    );
  }
});

test("parseExportRequest requires a token", () => {
  assert.throws(
    () => parseExportRequest(JSON.stringify({ documentId: DOC })),
    (err) => err instanceof HttpError && err.status === 401
  );
});

test("parseExportRequest rejects malformed JSON", () => {
  assert.throws(() => parseExportRequest("{"), (err) => err.status === 400);
});

function fakeRequest(chunks) {
  const req = new EventEmitter();
  req.destroy = () => {};
  queueMicrotask(() => {
    for (const c of chunks) req.emit("data", Buffer.from(c));
    req.emit("end");
  });
  return req;
}

test("readBody enforces the size limit", async () => {
  await assert.rejects(readBody(fakeRequest(["x".repeat(20)]), 10), (err) => err.status === 413);
  assert.equal(await readBody(fakeRequest(["ab", "cd"]), 10), "abcd");
});

test("isExportTokenValid asks Supabase and treats null as invalid", async () => {
  const env = { SUPABASE_URL: "https://p.supabase.co/", SUPABASE_ANON_KEY: "anon" };
  let calledUrl;
  const valid = await isExportTokenValid(TOKEN, env, async (url) => {
    calledUrl = url;
    return new Response("null", { status: 200 });
  });
  assert.equal(valid, false);
  assert.equal(calledUrl, "https://p.supabase.co/rest/v1/rpc/get_document_by_export_token");
  assert.equal(await isExportTokenValid(TOKEN, env, async () => new Response("{}", { status: 200 })), true);
});

test("isExportTokenValid is skipped without Supabase config", async () => {
  assert.equal(await isExportTokenValid(TOKEN, {}, () => assert.fail("should not fetch")), true);
});
