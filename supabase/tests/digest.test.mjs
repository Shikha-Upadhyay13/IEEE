import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDigest, describeItem, escapeHtml, itemUrl } from "../functions/notification-emails/digest.ts";

const item = (overrides) => ({
  id: "n1",
  kind: "comment",
  document_id: "d1",
  workspace_id: null,
  payload: { title: "Vision", actor: "ana@uni.edu", excerpt: "Check Fig. 2" },
  created_at: "2026-10-12T10:00:00Z",
  ...overrides,
});
const links = { appUrl: "https://app.example/", unsubscribeUrl: "https://app.example/unsubscribe?token=t" };

test("each item names who did what, and links to the paper", () => {
  assert.equal(describeItem(item({})), "ana@uni.edu commented on “Vision”");
  assert.equal(
    describeItem(item({ kind: "suggestion_decided", payload: { title: "Vision", actor: "bo@uni.edu", status: "accepted" } })),
    "bo@uni.edu accepted your suggestion on “Vision”",
  );
  assert.equal(itemUrl(item({}), links.appUrl), "https://app.example/editor/d1");
  assert.equal(itemUrl(item({ kind: "workspace_added", document_id: null }), links.appUrl), "https://app.example/dashboard");
});

test("one item uses it as the subject; several are counted", () => {
  assert.equal(buildDigest([item({})], links).subject, "ana@uni.edu commented on “Vision”");
  assert.equal(buildDigest([item({}), item({ id: "n2", kind: "mention" })], links).subject, "2 updates on your papers");
});

test("the email carries settings and unsubscribe links, and escapes user text", () => {
  const { text, html } = buildDigest([item({ payload: { title: "<b>X</b>", actor: "a@b.c", excerpt: "1 < 2" } })], links);
  assert.match(text, /Unsubscribe from notification email: https:\/\/app\.example\/unsubscribe\?token=t/);
  assert.match(text, /https:\/\/app\.example\/settings/);
  assert.ok(html.includes("&#60;b&#62;X&#60;/b&#62;"));
  assert.ok(html.includes("1 &#60; 2"));
  assert.ok(!html.includes("<b>X</b>"));
  assert.equal(escapeHtml(`"'&`), "&#34;&#39;&#38;");
});
