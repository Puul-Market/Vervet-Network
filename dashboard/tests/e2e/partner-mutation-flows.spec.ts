import { expect, test, type Page } from "@playwright/test";
import { openAdminSetupWorkspace } from "./helpers/admin-setup";

const ownerAccount = {
  email: "ops@ivorypay.demo",
  password: "Vervet-Ivorypay-2026!",
} as const;

test.describe("partner and admin mutation flows", () => {
  test.describe.configure({ mode: "serial" });

  test("owner can issue and revoke an API key", async ({ page }) => {
    await signIn(page, ownerAccount);
    await page.goto("/access/api-keys");

    const label = uniqueValue("playwright-api-key");

    await page.getByLabel("Label").fill(label);
    await page.getByRole("button", { name: "Create API Key" }).click();

    await expect(page.getByText("Credential issued")).toBeVisible();
    await expect(page.getByText(`Credential '${label}' is ready.`)).toBeVisible();
    await expect(page.locator(".flash-secret code")).toContainText("vpk_");

    const credentialRow = page.locator("tr").filter({ hasText: label });
    await expect(credentialRow).toBeVisible();

    await credentialRow.getByRole("button", { name: "Revoke" }).click();

    await expect(page.getByText("Credential revoked")).toBeVisible();
    await expect(
      page.getByText(`Credential '${label}' has been revoked.`),
    ).toBeVisible();
    await expect(credentialRow.getByText("REVOKED")).toBeVisible();
  });

  test("owner can invite a team user", async ({ page }) => {
    await signIn(page, ownerAccount);
    await page.goto("/access/team");

    const email = `${uniqueValue("invite")}@example.com`;
    const fullName = "Playwright Invite";

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Full name").fill(fullName);
    await page.locator('select[name="role"]').first().selectOption("DEVELOPER");
    await page.getByRole("button", { name: "Invite User" }).click();

    await expect(page.getByText("Invite created")).toBeVisible();
    await expect(page.getByText(`Invite ready for ${email}.`)).toBeVisible();
    await expect(page.locator(".flash-secret code")).not.toBeEmpty();
    await expect(page.locator("tr").filter({ hasText: email })).toBeVisible();
  });

  test("owner can create a webhook and mutate endpoint state", async ({ page }) => {
    await signIn(page, ownerAccount);
    await page.goto("/webhooks");

    const label = uniqueValue("playwright-webhook");
    const endpointUrl = buildWebhookEndpointUrl(label);
    const createWebhookForm = page.locator('form[action="/webhooks/actions/create"]');

    await createWebhookForm.getByLabel("Label").fill(label);
    await createWebhookForm.getByLabel("Endpoint URL").fill(endpointUrl);
    await createWebhookForm.getByRole("button", { name: "Create Webhook" }).click();

    await expect(page.getByText("Endpoint created")).toBeVisible();
    await expect(
      page.getByText(`Webhook endpoint '${label}' is active and ready for deliveries.`),
    ).toBeVisible();
    await expect(page.locator(".flash-secret code")).not.toBeEmpty();

    const endpointRow = page.locator("tr").filter({ hasText: label });
    await expect(endpointRow).toBeVisible();
    await endpointRow.getByRole("link", { name: "View detail" }).click();

    await expect(page.getByRole("heading", { name: label })).toBeVisible();

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Endpoint updated")).toBeVisible();
    await expect(
      page.getByText(`Webhook endpoint '${label}' is now paused.`),
    ).toBeVisible();
    await expect(page.getByText("PAUSED").first()).toBeVisible();

    await page.getByRole("button", { name: "Rotate Secret" }).click();
    await expect(page.getByText("Signing secret rotated")).toBeVisible();
    await expect(
      page.getByText(`Webhook endpoint '${label}' now uses signing secret version 2.`),
    ).toBeVisible();
    await expect(page.locator(".flash-secret code")).not.toBeEmpty();
  });

  test("admin can create a partner, update partner state, and grant a corridor", async ({
    page,
  }) => {
    await signInAdminSetup(page);

    const slug = uniqueValue("playwright-partner");
    const displayName = `Playwright ${slug}`;
    const createPartnerForm = page.locator('form[action="/setup/actions/create-partner"]');

    await createPartnerForm.getByLabel("Partner slug").fill(slug);
    await createPartnerForm.getByLabel("Display name").fill(displayName);
    await createPartnerForm
      .locator('select[name="partnerType"]')
      .selectOption("FINTECH");
    await createPartnerForm.getByRole("button", { name: "Create partner" }).click();

    await expect(page.getByText("Partner created")).toBeVisible();
    await expect(
      page.getByText(`Partner '${slug}' is ready for key registration and owner-user setup.`),
    ).toBeVisible();

    const selectedPartnerCard = page.locator(".detail-card").filter({
      hasText: "Selected partner",
    });
    await expect(selectedPartnerCard).toBeVisible();
    await expect(selectedPartnerCard).toContainText(slug);

    const updatePartnerStateForm = page.locator(
      'form[action="/setup/actions/update-partner-admin-state"]',
    );

    await updatePartnerStateForm
      .locator('select[name="onboardingStage"]')
      .selectOption("API_ACCESS_READY");
    await updatePartnerStateForm
      .locator('select[name="feedHealthStatus"]')
      .selectOption("HEALTHY");
    await updatePartnerStateForm
      .getByRole("button", { name: "Update partner state" })
      .click();

    await expect(page.getByText("Partner state updated")).toBeVisible();
    await expect(
      page.getByText(`Updated admin capability and readiness controls for '${slug}'.`),
    ).toBeVisible();
    await expect(
      updatePartnerStateForm.locator('select[name="onboardingStage"]'),
    ).toHaveValue("API_ACCESS_READY");
    await expect(
      updatePartnerStateForm.locator('select[name="feedHealthStatus"]'),
    ).toHaveValue("HEALTHY");

    const grantCorridorCard = page.locator(".detail-card").filter({
      hasText: "Production corridor controls",
    });
    const grantCorridorForm = grantCorridorCard.locator(
      'form[action="/setup/actions/update-production-corridor"]',
    );
    const corridorSelect = grantCorridorForm.locator('select[name="assetNetworkId"]');
    const corridorOption = corridorSelect.locator('option:not([value=""])').first();
    const corridorValue = await corridorOption.getAttribute("value");

    expect(corridorValue).toBeTruthy();

    await corridorSelect.selectOption(corridorValue!);
    await grantCorridorForm.getByRole("button", { name: "Grant corridor" }).click();

    await expect(page.getByText("Production corridor granted")).toBeVisible();
    await expect(
      page.getByText(`Granted production corridor access for '${slug}'.`),
    ).toBeVisible();
    await expect(selectedPartnerCard.getByText("1 granted")).toBeVisible();
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

function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildWebhookEndpointUrl(label: string) {
  return `https://example.com/webhooks/${encodeURIComponent(label)}`;
}
