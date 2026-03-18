import { expect, test, type Page } from "@playwright/test";
import { openAdminSetupWorkspace } from "./helpers/admin-setup";

const partnerAccounts = {
  owner: {
    email: "ops@ivorypay.demo",
    password: "Vervet-Ivorypay-2026!",
  },
  analyst: {
    email: "analyst@ivorypay.demo",
    password: "Vervet-Ivorypay-Analyst-2026!",
  },
  developer: {
    email: "developer@ivorypay.demo",
    password: "Vervet-Ivorypay-Developer-2026!",
  },
} as const;

test.describe("partner roles and admin setup flows", () => {
  test("owner sees full partner access navigation", async ({ page }) => {
    await signIn(page, partnerAccounts.owner);

    await expect(
      page.getByRole("link", { name: "API Keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Signing Keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Team", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toBeVisible();
  });

  test("analyst sees read-only partner surfaces and no key/team/security navigation", async ({
    page,
  }) => {
    await signIn(page, partnerAccounts.analyst);

    await expect(
      page.getByRole("link", { name: "API Keys", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Signing Keys", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Team", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toHaveCount(0);

    await page.goto("/audit/logs");

    await expect(
      page.getByRole("heading", { name: "Audit Log" }),
    ).toBeVisible();
  });

  test("developer can manage integration surfaces but not organization admin surfaces", async ({
    page,
  }) => {
    await signIn(page, partnerAccounts.developer);

    await expect(
      page.getByRole("link", { name: "API Keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Signing Keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Team", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Security", exact: true }),
    ).toHaveCount(0);

    await page.goto("/access/api-keys");

    await expect(
      page.getByRole("heading", { name: "API Keys" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create API Key" }),
    ).toBeVisible();
  });

  test("admin setup workspace shows the pending review queue and partner controls", async ({
    page,
  }) => {
    await signInAdminSetup(page);

    const pendingApprovalCard = page
      .locator(".detail-card")
      .filter({
        has: page.getByRole("button", { name: "Approve" }),
      })
      .first();

    await expect(
      page.getByRole("heading", { name: "Internal partner review workspace" }),
    ).toBeVisible();
    await expect(page.getByText("Pending production approvals")).toBeVisible();
    await expect(pendingApprovalCard).toBeVisible();
    await expect(
      pendingApprovalCard.getByRole("button", { name: "Approve" }),
    ).toBeVisible();

    await page.goto("/setup?partnerSlug=atlas-consumer-demo");

    const selectedPartnerCard = page.locator(".detail-card").filter({
      hasText: "Selected partner",
    });

    await expect(selectedPartnerCard).toBeVisible();
    await expect(selectedPartnerCard.getByText("atlas-consumer-demo")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update partner state" }),
    ).toBeVisible();
  });
});

async function signIn(
  page: Page,
  credentials: { email: string; password: string },
) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL("**/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

async function signInAdminSetup(page: Page) {
  await openAdminSetupWorkspace(page);
}
