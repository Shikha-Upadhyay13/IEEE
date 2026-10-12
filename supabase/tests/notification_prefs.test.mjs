import { test } from "node:test";
import assert from "node:assert/strict";
import { as, createDb, createUser } from "./db.mjs";

async function setup() {
  const db = await createDb();
  const users = {
    owner: await createUser(db, "owner@uni.edu"),
    reviewer: await createUser(db, "reviewer@uni.edu"),
  };
  const { rows } = await db.query("insert into documents (owner_id, title, content) values ($1, 'Vision', '{}'::jsonb) returning id", [users.owner]);
  const doc = rows[0].id;
  await as(db, users.owner, (tx) => tx.query("select invite_to_document($1, 'reviewer@uni.edu', 'reviewer')", [doc]));
  await db.query("delete from notifications");
  return { db, doc, users };
}

const comment = (db, user, doc, body, mentions = []) =>
  as(db, user, (tx) => tx.query("insert into comments (document_id, body, mentions) values ($1, $2, $3)", [doc, body, mentions]));

// Backdates every notification past the email delay; the update guard would refuse the change.
const age = (db) =>
  db.exec(`
    set session_replication_role = replica;
    update notifications set created_at = now() - interval '11 minutes';
    set session_replication_role = origin;
  `);

const delivered = async (db, user) =>
  (await db.query("select kind, show_in_app, email_state from notifications where user_id = $1 order by created_at", [user])).rows;

test("the event × channel matrix decides in-app and email delivery", async () => {
  const { db, doc, users } = await setup();
  await comment(db, users.reviewer, doc, "First");
  assert.deepEqual(await delivered(db, users.owner), [{ kind: "comment", show_in_app: true, email_state: "pending" }]);

  await db.query("delete from notifications");
  await as(db, users.owner, (tx) =>
    tx.query("insert into notification_preferences (user_id, kind, in_app, email) values ($1, 'comment', false, true)", [users.owner])
  );
  await comment(db, users.reviewer, doc, "Second");
  assert.deepEqual(await delivered(db, users.owner), [{ kind: "comment", show_in_app: false, email_state: "pending" }]);
  const inbox = await as(db, users.owner, (tx) => tx.query("select id from notifications"));
  assert.equal(inbox.rows.length, 0, "email-only items stay out of the inbox");

  await db.query("delete from notifications");
  await as(db, users.owner, (tx) => tx.query("update notification_preferences set email = false where kind = 'comment'"));
  await comment(db, users.reviewer, doc, "Third");
  assert.deepEqual(await delivered(db, users.owner), [], "both channels off means nothing is stored");
});

test("paper levels mute a paper or narrow it to mentions and replies", async () => {
  const { db, doc, users } = await setup();
  const setLevel = (level) =>
    as(db, users.owner, (tx) =>
      tx.query(
        "insert into paper_notification_levels (user_id, document_id, level) values ($1, $2, $3) on conflict (user_id, document_id) do update set level = excluded.level",
        [users.owner, doc, level]
      )
    );

  await setLevel("mentions");
  await comment(db, users.reviewer, doc, "General");
  await comment(db, users.reviewer, doc, "Hey @owner", [users.owner]);
  assert.deepEqual((await delivered(db, users.owner)).map((n) => n.kind), ["mention"]);

  await db.query("delete from notifications");
  await setLevel("none");
  await comment(db, users.reviewer, doc, "Hey again @owner", [users.owner]);
  assert.deepEqual(await delivered(db, users.owner), []);

  const stranger = await createUser(db, "stranger@uni.edu");
  await assert.rejects(
    as(db, stranger, (tx) =>
      tx.query("insert into paper_notification_levels (user_id, document_id, level) values ($1, $2, 'none')", [stranger, doc])
    ),
    /row-level security/
  );
});

test("email digests send only items still unread after the delay, once", async () => {
  const { db, doc, users } = await setup();
  await comment(db, users.reviewer, doc, "Read soon");
  await comment(db, users.reviewer, doc, "Left unread");
  await as(db, users.owner, (tx) => tx.query("update notifications set read_at = now() where payload->>'excerpt' = 'Read soon'"));

  assert.equal((await db.query("select * from claim_notification_emails()")).rows.length, 0, "nothing is ten minutes old yet");

  await age(db);
  const { rows } = await db.query("select recipient, address, token, items from claim_notification_emails()");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].address, "owner@uni.edu");
  assert.deepEqual(rows[0].items.map((i) => i.payload.excerpt), ["Left unread"]);
  assert.equal((await db.query("select * from claim_notification_emails()")).rows.length, 0, "claimed items are not sent twice");

  await db.query("select requeue_notification_emails($1)", [rows[0].items.map((i) => i.id)]);
  assert.equal((await db.query("select * from claim_notification_emails()")).rows.length, 1, "failed sends are retried");

  await assert.rejects(
    as(db, users.owner, (tx) => tx.query("update notifications set email_state = 'pending'")),
    /Only the read state/
  );
});

test("one-click unsubscribe stops notification email, signed in or not", async () => {
  const { db, doc, users } = await setup();
  await comment(db, users.reviewer, doc, "Hello");
  await age(db);
  const [{ token }] = (await db.query("select token from claim_notification_emails()")).rows;

  const result = await as(db, null, (tx) => tx.query("select unsubscribe_notification_emails($1) as ok", [token]));
  assert.equal(result.rows[0].ok, true);
  const wrong = await as(db, null, (tx) => tx.query("select unsubscribe_notification_emails(gen_random_uuid()) as ok"));
  assert.equal(wrong.rows[0].ok, false);

  await comment(db, users.reviewer, doc, "Hello again");
  await age(db);
  assert.equal((await db.query("select * from claim_notification_emails()")).rows.length, 0);

  await as(db, users.owner, (tx) => tx.query("select set_notification_emails(true)"));
  const settings = await as(db, users.owner, (tx) => tx.query("select notification_emails from email_settings"));
  assert.deepEqual(settings.rows, [{ notification_emails: true }]);
  const changed = await as(db, users.owner, (tx) => tx.query("update email_settings set unsubscribe_token = gen_random_uuid() returning user_id"));
  assert.equal(changed.rows.length, 0, "the token can't be replaced by a guessable one");
});
