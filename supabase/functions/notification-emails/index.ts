// Sends notification email digests, and accepts one-click unsubscribes.
//
// POST with header x-cron-secret: claims every notification still unread after
//   10 minutes and sends each recipient one email (run it every few minutes).
// POST ?unsubscribe=<token>: RFC 8058 one-click unsubscribe from mail clients.
//
// Deploy with --no-verify-jwt: mail clients can't send a Supabase JWT.
// Secrets: RESEND_API_KEY, NOTIFY_FROM, APP_URL, CRON_SECRET.

import { buildDigest, type DigestItem } from "./digest.ts";

type Batch = { recipient: string; address: string; token: string; items: DigestItem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing the ${name} secret`);
  return value;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${await res.text()}`);
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

async function send(batch: Batch) {
  const appUrl = env("APP_URL").replace(/\/+$/, "");
  const digest = buildDigest(batch.items, { appUrl, unsubscribeUrl: `${appUrl}/unsubscribe?token=${batch.token}` });
  const oneClick = `${env("SUPABASE_URL")}/functions/v1/notification-emails?unsubscribe=${batch.token}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("NOTIFY_FROM"),
      to: [batch.address],
      subject: digest.subject,
      text: digest.text,
      html: digest.html,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

function sameSecret(given: string | null, expected: string): boolean {
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = new URL(req.url).searchParams.get("unsubscribe");
  if (token !== null) {
    if (!UUID.test(token)) return new Response("Invalid unsubscribe link", { status: 400 });
    await rpc<boolean>("unsubscribe_notification_emails", { token });
    return new Response("Unsubscribed from notification email", { status: 200 });
  }

  if (!sameSecret(req.headers.get("x-cron-secret"), env("CRON_SECRET"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const batches = (await rpc<Batch[] | null>("claim_notification_emails", {})) ?? [];
  let sent = 0;
  let failed = 0;
  for (const batch of batches) {
    try {
      await send(batch);
      sent++;
    } catch (err) {
      failed++;
      console.error(`Notification email to ${batch.recipient} failed:`, err);
      await rpc("requeue_notification_emails", { ids: batch.items.map((i) => i.id) });
    }
  }
  return Response.json({ sent, failed });
});
