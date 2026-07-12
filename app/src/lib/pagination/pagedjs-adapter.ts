import { Previewer } from "pagedjs";

/**
 * Paginates the (unpaginated) content in `source` into real, page-sized
 * chunks inside `target`, using the @page/column rules from `stylesheetUrls`.
 * This is the one place Paged.js is invoked — both the live editor preview
 * and the future print route call this same function.
 */
export async function paginateInto(
  source: HTMLElement,
  target: HTMLElement,
  stylesheetUrls: string[]
): Promise<void> {
  target.innerHTML = "";
  const previewer = new Previewer();
  await previewer.preview(source.innerHTML, stylesheetUrls, target);
}
