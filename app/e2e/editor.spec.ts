import { expect, test, type Page } from "@playwright/test";

// Needs a real Supabase test account; skipped unless both are provided.
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
// Export also needs pdf-service running at VITE_PDF_SERVICE_URL.
const WITH_PDF = process.env.E2E_PDF_SERVICE === "1";

test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run the signed-in editor flow");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@university.edu").fill(EMAIL!);
  await page.locator('input[type="password"]').fill(PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  const skip = page.getByRole("button", { name: /skip/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test("create, reorder, cite, cross-reference and export a paper", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: /New paper/ }).click();
  await page.getByRole("menuitem", { name: /Research paper/ }).click();
  await expect(page).toHaveURL(/\/editor\//);

  const outline = page.getByRole("navigation", { name: "Paper outline" });
  const sections = outline.getByRole("listitem");
  await expect(sections.first()).toContainText("Introduction");

  await outline.getByRole("button", { name: "Move Introduction down" }).click();
  await expect(sections.first()).toContainText("Methodology");
  await expect(sections.nth(1)).toContainText("Introduction");

  await outline.getByRole("button", { name: /^References/ }).click();
  await page.getByRole("button", { name: "+ Manual Reference" }).click();
  await page.getByPlaceholder("J. F. Fuller, E. F. Fuchs, and K. J. Roesler").fill("A. Author");
  await page.getByPlaceholder("Influence of harmonics on power distribution system protection").fill("An end-to-end test reference");
  await page.getByPlaceholder("1988").fill("2024");

  await outline.getByRole("button", { name: /Whole paper/ }).click();
  await page.getByRole("button", { name: /Add block/ }).click();
  await page.getByRole("menuitem", { name: /^Figure/ }).click();

  await outline.getByRole("button", { name: /Introduction/ }).first().click();
  const paragraph = page.locator(".ProseMirror").first();
  await paragraph.click();
  await page.keyboard.type("Prior work is summarised in ");

  await page.getByRole("button", { name: "Cite", exact: true }).first().click();
  await page.getByRole("menuitem").first().click();
  await expect(paragraph).toContainText("[1]");

  await paragraph.press("End");
  await page.keyboard.type(" and shown in ");
  await page.getByRole("button", { name: "Cross-ref", exact: true }).first().click();
  await page.getByRole("menuitem").first().click();
  await expect(paragraph).toContainText(/Fig\. 1/);

  if (WITH_PDF) {
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: "Export PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  }
});
