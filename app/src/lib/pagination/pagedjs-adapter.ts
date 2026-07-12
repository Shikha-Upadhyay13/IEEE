import { Previewer } from "pagedjs";

/**
 * Paginates `sourceHtml` into real, page-sized chunks, using the @page/column
 * rules from `stylesheetUrls`. Renders into a detached scratch container (never
 * the visible DOM) so a caller can discard the result of a superseded/stale run
 * without it ever having touched the page — see PagedPreview for why that
 * matters (React StrictMode double-invokes effects in dev, and rapid edits can
 * trigger overlapping runs in production too). This is the one place Paged.js
 * is invoked — both the live editor preview and the future print route call it.
 */
export async function paginate(
  sourceHtml: string,
  stylesheetUrls: string[]
): Promise<DocumentFragment> {
  // Paged.js measures real layout (getBoundingClientRect etc.), so its render
  // target must be attached to the document while it runs — a fully detached
  // element fails with null-reference errors deep inside its Layout class.
  // Off-screen (not display:none — that also breaks measurement) is enough.
  const scratch = document.createElement("div");
  scratch.style.position = "absolute";
  scratch.style.left = "-99999px";
  scratch.style.top = "0";
  document.body.appendChild(scratch);
  try {
    const previewer = new Previewer();
    await previewer.preview(sourceHtml, stylesheetUrls, scratch);
    const fragment = document.createDocumentFragment();
    fragment.append(...Array.from(scratch.childNodes));
    return fragment;
  } finally {
    scratch.remove();
  }
}
