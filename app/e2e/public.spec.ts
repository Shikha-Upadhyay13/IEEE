import { expect, test } from "@playwright/test";

test("landing page explains the product and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Write the paper/ })).toBeVisible();
  await expect(page.getByText(/not affiliated with or endorsed by IEEE/i)).toBeVisible();
  await page.getByRole("link", { name: "Start writing" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("login page shows the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@university.edu")).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test("public pages have their own title, description and crawler files", async ({ page, request }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle("Privacy Policy · IEEE Paper Builder");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /export or delete your data/);

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap:");
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("<urlset");
});

test("the sample paper paginates onto US Letter pages with two IEEE columns", async ({ page }) => {
  await page.goto("/");
  const firstPage = page.locator(".pagedjs_page").first();
  await expect(firstPage).toBeAttached({ timeout: 30_000 });
  const size = await firstPage.evaluate((el) => {
    const style = getComputedStyle(el);
    return { width: parseFloat(style.width), height: parseFloat(style.height) };
  });
  expect(size.width).toBeCloseTo(8.5 * 96, 0);
  expect(size.height).toBeCloseTo(11 * 96, 0);
  const columns = await page
    .locator(".pagedjs_page .ieee-columns")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { count: style.columnCount, gap: parseFloat(style.columnGap) };
    });
  expect(columns.count).toBe("2");
  expect(columns.gap).toBeCloseTo(0.25 * 96, 0);
});

test("signed-out visitors are sent from the dashboard to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("legal pages render without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
