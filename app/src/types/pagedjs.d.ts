// pagedjs ships no TypeScript types; this is the minimal surface we actually use.
declare module "pagedjs" {
  export class Previewer {
    preview(
      content: string | HTMLElement,
      stylesheetUrls: string[],
      renderTo: HTMLElement
    ): Promise<unknown>;
  }
}
