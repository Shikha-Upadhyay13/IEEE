import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createDb, createUser } from "./db.mjs";

// The SQL blocks under "Restoring a paper" in docs/RUNBOOK.md, run as written.
const runbook = readFileSync(new URL("../../docs/RUNBOOK.md", import.meta.url), "utf8");
const section = runbook.slice(runbook.indexOf("## Restoring a paper"), runbook.indexOf("## Rotating keys"));
const [, restoreSql] = [...section.matchAll(/```sql\r?\n([\s\S]*?)```/g)].map((m) => m[1]);

const paper = (title, body) => ({ titleBlock: { title: [{ type: "text", text: title }] }, body: [{ type: "paragraph", text: body }] });

test("the runbook's restore SQL brings a snapshot back and keeps a copy of what it replaced", async () => {
  const db = await createDb();
  const owner = await createUser(db, "owner@uni.edu");
  const { rows: [doc] } = await db.query(
    "insert into documents (owner_id, title, content) values ($1, 'Damaged', $2) returning id, version",
    [owner, paper("Damaged", "oops")],
  );
  const { rows: [snap] } = await db.query(
    "insert into document_versions (document_id, title, content) values ($1, 'Before switching to Journal', $2) returning id",
    [doc.id, paper("Original title", "good text")],
  );

  await db.exec(restoreSql.replaceAll("<paper id>", doc.id).replaceAll("<snapshot id>", snap.id));

  const { rows: [after] } = await db.query("select title, content, version from documents where id = $1", [doc.id]);
  assert.equal(after.title, "Original title");
  assert.equal(after.content.body[0].text, "good text");
  assert.equal(after.version, doc.version + 1);

  const { rows: kept } = await db.query("select content from document_versions where document_id = $1 and title = 'Before support restore'", [doc.id]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].content.body[0].text, "oops");
});
