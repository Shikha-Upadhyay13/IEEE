import { expect, test } from "@playwright/test";

test("template gallery remembers the choice through sign-in", async ({ page }) => {
  await page.goto("/templates");
  await expect(page).toHaveTitle(/IEEE Paper Templates/);
  const buttons = page.getByRole("button", { name: "Use this template" });
  await expect(buttons).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Open the example" })).toBeVisible();

  await buttons.nth(2).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem("ieee:pendingTemplate"))).toBe("survey");
});

test("guides index links to every tool", async ({ page }) => {
  await page.goto("/guides");
  await expect(page).toHaveTitle(/Free IEEE formatting tools/);
  for (const name of ["IEEE reference formatter", "BibTeX to IEEE converter", "IEEE abstract word counter"]) {
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
});

test("reference formatter builds an IEEE reference from typed fields", async ({ page }) => {
  await page.goto("/guides/ieee-reference-format");
  await page.getByLabel(/^Authors/).fill("John F. Fuller\nFuchs, Ewald F.");
  await page.getByLabel("Article title").fill("Influence of harmonics");
  await page.getByLabel(/Journal or conference/).fill("IEEE Trans. Power Del.");
  await page.getByLabel("Year").fill("1988");
  await expect(page.locator("output")).toHaveText(
    '[1] J. F. Fuller and E. F. Fuchs, "Influence of harmonics," IEEE Trans. Power Del., 1988.'
  );
});

test("BibTeX converter numbers the sample entry", async ({ page }) => {
  await page.goto("/guides/bibtex-to-ieee");
  await expect(page.locator("output li").first()).toContainText(
    '[1] J. F. Fuller, E. F. Fuchs, and K. J. Roesler, "Influence of harmonics'
  );
});

test("abstract counter counts words and flags citations", async ({ page }) => {
  await page.goto("/guides/ieee-abstract-word-count");
  await page.getByLabel("Abstract").fill("We extend the method of [2] to larger graphs.");
  await expect(page.getByText(/^9\s*\/\s*250 words$/)).toBeVisible();
  await expect(page.getByText(/should not cite references/)).toBeVisible();
  await page.getByText("150 words").click();
  await expect(page.getByText("/ 150 words")).toBeVisible();
});
