import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/terms",
  "/privacy",
  "/guides",
  "/guides/ieee-reference-format",
  "/guides/bibtex-to-ieee",
  "/guides/ieee-abstract-word-count",
];

for (const route of PUBLIC_ROUTES) {
  test(`no serious accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(", ")})`);
    expect(serious).toEqual([]);
  });
}

test("keyboard users can skip to the main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to main content" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
