import { expect, test, type Page } from "@playwright/test";
import { openAdminSetupWorkspace } from "./helpers/admin-setup";

test.describe("partner onboarding and approval flows", () => {
  test.describe.configure({ mode: "serial" });

  let stagedPartner:
    | {
        displayName: string;
        email: string;
        password: string;
        slug: string;
      }
    | undefined;

  test("admin can complete first-owner onboarding for a new partner", async ({
    page,
  }) => {
    await signInAdminSetup(page);

    const slug = uniqueValue("playwright-onboarded");
    const displayName = `Playwright ${slug}`;
    const ownerEmail = `${slug}@example.com`;
    const ownerPassword = `Vervet-${slug}-Owner!`;

    stagedPartner = {
      displayName,
      email: ownerEmail,
      password: ownerPassword,
      slug,
    };

    const createPartnerForm = page.locator(
      'form[action="/setup/actions/create-partner"]',
    );

    await createPartnerForm.getByLabel("Partner slug").fill(slug);
    await createPartnerForm.getByLabel("Display name").fill(displayName);
    await createPartnerForm
      .locator('select[name="partnerType"]')
      .selectOption("FINTECH");
    await createPartnerForm.getByRole("button", { name: "Create partner" }).click();

    await expect(page.getByText("Partner created")).toBeVisible();
    await expect(
      page.getByText(
        `Partner '${slug}' is ready for key registration and owner-user setup.`,
      ),
    ).toBeVisible();

    const createOwnerForm = page.locator(
      'form[action="/setup/actions/create-owner-user"]',
    );
    await createOwnerForm.getByLabel("Partner slug").fill(slug);
    await createOwnerForm.getByLabel("Full name").fill("Playwright Owner");
    await createOwnerForm.getByLabel("Work email").fill(ownerEmail);
    await createOwnerForm.getByLabel("Temporary password").fill(ownerPassword);
    await createOwnerForm.getByRole("button", { name: "Create owner user" }).click();

    await expect(page.getByText("Owner user created")).toBeVisible();
    await expect(
      page.getByText(
        `Owner user '${ownerEmail}' is ready to sign in to the partner dashboard.`,
      ),
    ).toBeVisible();

    await page.goto("/");
    await page.getByLabel("Email address").fill(ownerEmail);
    await page.getByLabel("Password").fill(ownerPassword);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("**/overview");

    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();
    await expect(page.getByText(displayName)).toBeVisible();
    await expect(page.getByText("Platform onboarding")).toBeVisible();
  });

  test("new owner can complete setup prerequisites and request then cancel production approval", async ({
    page,
  }) => {
    test.fail(!stagedPartner, "The staged partner fixture was not created.");

    const activePartner = stagedPartner!;

    await signIn(page, {
      email: activePartner.email,
      password: activePartner.password,
    });

    await page.goto("/access/api-keys");

    const credentialLabel = uniqueValue("playwright-approval-key");
    await page.getByLabel("Label").fill(credentialLabel);
    await page.getByRole("button", { name: "Create API Key" }).click();

    await expect(page.getByText("Credential issued")).toBeVisible();
    await expect(
      page.getByText(`Credential '${credentialLabel}' is ready.`),
    ).toBeVisible();

    await page.goto("/webhooks");

    const webhookLabel = uniqueValue("playwright-approval-webhook");
    const webhookForm = page.locator('form[action="/webhooks/actions/create"]');
    await webhookForm.getByLabel("Label").fill(webhookLabel);
    await webhookForm
      .getByLabel("Endpoint URL")
      .fill(`https://${webhookLabel}.example.com/webhooks/vervet`);
    await webhookForm.getByRole("button", { name: "Create Webhook" }).click();

    await expect(page.getByText("Endpoint created")).toBeVisible();
    await expect(
      page.getByText(
        `Webhook endpoint '${webhookLabel}' is active and ready for deliveries.`,
      ),
    ).toBeVisible();

    await page.goto("/resolution/by-recipient");
    await page.getByLabel("Recipient identifier").fill("merchant@ivorypay");
    await page.getByRole("button", { name: "Resolve" }).click();

    await expect(
      page.locator(".result-summary").getByText("Acme Merchant", { exact: true }),
    ).toBeVisible();

    await page.goto("/setup");
    await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();

    const requestForm = page.locator(
      'form[action="/setup/actions/request-production-approval"]',
    );
    await expect(requestForm).toBeVisible();

    const corridorCheckbox = requestForm
      .locator('input[name="assetNetworkIds"]')
      .first();
    await corridorCheckbox.check();
    await requestForm
      .getByLabel("Request note")
      .fill("Playwright production approval request.");
    await requestForm
      .getByRole("button", { name: "Request production approval" })
      .click();

    await expect(
      page.getByText("Production approval requested"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Your organization has submitted a production approval request. Review status will appear in Setup.",
      ),
    ).toBeVisible();

    const cancelRequestForm = page.locator(
      'form[action="/setup/actions/cancel-production-approval"]',
    );
    await expect(cancelRequestForm).toBeVisible();
    await expect(
      page.locator(".detail-card").filter({ hasText: "Current status" }),
    ).toContainText("Pending");

    await cancelRequestForm
      .getByRole("button", { name: "Cancel pending request" })
      .click();

    await expect(
      page.getByText("Production approval request cancelled"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "The pending production approval request has been cancelled. You can submit a new request after making the required changes.",
      ),
    ).toBeVisible();
    await expect(requestForm).toBeVisible();
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
