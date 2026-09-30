import { expect, test } from "@playwright/test";

test("landing page explains the product and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/not affiliated with or endorsed by IEEE/i)).toBeVisible();
  await page.getByRole("link", { name: "Start writing" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("login page shows the sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@university.edu")).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
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
