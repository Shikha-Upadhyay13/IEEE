// Turns one recipient's unread notifications into a single email. No Deno or
// Node APIs here, so supabase/tests can run it directly.

export type DigestItem = {
  id: string;
  kind: string;
  document_id: string | null;
  workspace_id: string | null;
  payload: { title?: string; workspace?: string; role?: string; excerpt?: string; status?: string; actor?: string };
  created_at: string;
};

export type DigestLinks = { appUrl: string; unsubscribeUrl: string };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** The same phrasing as the in-app inbox, with who did it in front. */
export function describeItem(item: DigestItem): string {
  const actor = item.payload.actor ?? "Someone";
  const title = `“${item.payload.title ?? "a paper"}”`;
  switch (item.kind) {
    case "paper_shared":
      return `${actor} shared ${title} with you${item.payload.role ? ` as ${item.payload.role}` : ""}`;
    case "workspace_added":
      return item.payload.workspace
        ? `${actor} added you to the ${item.payload.workspace} workspace`
        : `${actor} added you to a workspace`;
    case "mention":
      return `${actor} mentioned you in ${title}`;
    case "reply":
      return `${actor} replied in a thread on ${title}`;
    case "comment":
      return `${actor} commented on ${title}`;
    case "suggestion":
      return `${actor} suggested an edit to ${title}`;
    case "suggestion_decided":
      return `${actor} ${item.payload.status === "accepted" ? "accepted" : "declined"} your suggestion on ${title}`;
    default:
      return `${actor} did something on ${title}`;
  }
}

export function itemUrl(item: DigestItem, appUrl: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return item.document_id ? `${base}/editor/${item.document_id}` : `${base}/dashboard`;
}

export function buildDigest(items: DigestItem[], links: DigestLinks): { subject: string; text: string; html: string } {
  const settingsUrl = `${links.appUrl.replace(/\/+$/, "")}/settings`;
  const subject =
    items.length === 1 ? truncate(describeItem(items[0]), 120) : `${items.length} updates on your papers`;

  const text = [
    ...items.map((item) => {
      const excerpt = item.payload.excerpt ? `\n  "${item.payload.excerpt}"` : "";
      return `- ${describeItem(item)}${excerpt}\n  ${itemUrl(item, links.appUrl)}`;
    }),
    "",
    `You're getting this because these were still unread in IEEE Paper Builder.`,
    `Choose what you hear about: ${settingsUrl}`,
    `Unsubscribe from notification email: ${links.unsubscribeUrl}`,
  ].join("\n");

  const rows = items
    .map((item) => {
      const excerpt = item.payload.excerpt
        ? `<div style="color:#6b6459;font-size:13px;margin-top:2px">${escapeHtml(item.payload.excerpt)}</div>`
        : "";
      return `<li style="margin:0 0 14px"><a href="${escapeHtml(itemUrl(item, links.appUrl))}" style="color:#1f1b16;text-decoration:none">${escapeHtml(describeItem(item))}</a>${excerpt}</li>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;font-size:14px;color:#1f1b16;max-width:560px;margin:0 auto;padding:24px">
<p style="font-weight:600;margin:0 0 16px">IEEE Paper Builder</p>
<ul style="padding-left:18px;margin:0 0 24px">${rows}</ul>
<p style="color:#6b6459;font-size:12px;margin:0">You're getting this because these were still unread.
<a href="${escapeHtml(settingsUrl)}" style="color:#6b6459">Choose what you hear about</a> ·
<a href="${escapeHtml(links.unsubscribeUrl)}" style="color:#6b6459">Unsubscribe</a></p>
</body></html>`;

  return { subject, text, html };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
