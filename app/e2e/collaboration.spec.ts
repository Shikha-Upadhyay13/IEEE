import { expect, test, type Browser, type Page } from "@playwright/test";

// Needs two existing accounts on a test Supabase project (see docs/RELEASE.md);
// skipped unless all four variables are set. Neither account may have
// two-factor sign-in turned on.
const OWNER = { email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD };
const REVIEWER = { email: process.env.E2E_EMAIL_2, password: process.env.E2E_PASSWORD_2 };

test.skip(
  !OWNER.email || !OWNER.password || !REVIEWER.email || !REVIEWER.password,
  "Set E2E_EMAIL, E2E_PASSWORD, E2E_EMAIL_2 and E2E_PASSWORD_2 to run the sharing and comments flow",
);

async function signedIn(browser: Browser, who: { email?: string; password?: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByPlaceholder("you@university.edu").fill(who.email!);
  await page.locator('input[type="password"]').fill(who.password!);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);
  const skip = page.getByRole("button", { name: /skip/i });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  return page;
}

test("share a paper with a reviewer, who comments; the owner replies and resolves", async ({ browser }) => {
  const stamp = Date.now();
  const owner = await signedIn(browser, OWNER);

  await owner.getByRole("button", { name: /New paper/ }).click();
  await owner.getByRole("menuitem", { name: /Research paper/ }).click();
  await expect(owner).toHaveURL(/\/editor\//);
  const paperId = owner.url().split("/editor/")[1].split(/[?#]/)[0];

  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await owner.getByLabel("Email to invite").fill(REVIEWER.email!);
  await owner.getByLabel("Role for the invited person").selectOption("reviewer");
  await owner.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(owner.getByText(`${REVIEWER.email} can now open this paper as a reviewer.`)).toBeVisible();
  await owner.getByRole("button", { name: "Close share options" }).click();

  const reviewer = await signedIn(browser, REVIEWER);
  await reviewer.goto(`/editor/${paperId}`);
  await expect(reviewer).toHaveURL(new RegExp(`/view/${paperId}`));
  await expect(reviewer.getByText("Read-only · reviewer")).toBeVisible();

  const note = `E2E review note ${stamp}`;
  await reviewer.getByRole("button", { name: "Comments", exact: true }).click();
  await reviewer.getByLabel("New comment").fill(note);
  await reviewer.getByRole("button", { name: "Comment", exact: true }).click();
  await expect(reviewer.getByRole("dialog").getByText(note)).toBeVisible();

  await owner.reload();
  await owner.getByRole("button", { name: "Comments", exact: true }).click();
  const panel = owner.getByRole("dialog", { name: "Feedback" });
  await expect(panel.getByText(note)).toBeVisible();
  await panel.getByLabel("Reply to this thread").fill("Thanks, fixed.");
  await panel.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(panel.getByText("Thanks, fixed.")).toBeVisible();
  await panel.getByRole("button", { name: "Resolve" }).click();
  await expect(panel.getByRole("tab", { name: /^Resolved \(1\)/ })).toBeVisible();

  await reviewer.reload();
  await reviewer.getByRole("button", { name: "Comments", exact: true }).click();
  await reviewer.getByRole("tab", { name: /^Resolved/ }).click();
  await expect(reviewer.getByRole("dialog").getByText("Thanks, fixed.")).toBeVisible();

  await panel.getByRole("button", { name: "Close comments" }).click();
  await owner.getByRole("button", { name: "Share", exact: true }).click();
  await owner.getByRole("button", { name: `Remove ${REVIEWER.email}` }).click();
  await expect(owner.getByRole("button", { name: `Remove ${REVIEWER.email}` })).toHaveCount(0);
});
