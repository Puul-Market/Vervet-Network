import { expect, test, type Locator, type Page } from "@playwright/test";
import { openAdminSetupWorkspace } from "./helpers/admin-setup";

test.describe("admin production-governance flows", () => {
  test.describe.configure({ mode: "serial" });

  test("admin can approve with corridor scope override, then revoke and re-grant production access", async ({
    page,
  }) => {
    await signInAdminSetup(page);

    const reviewPanel = page.locator(".panel").filter({
      hasText: "Pending production approvals",
    });
    const approvalCard = reviewPanel.locator(".detail-card").filter({
      hasText: "Atlas Consumer Demo",
    });
    const reviewForm = approvalCard.locator(
      'form[action="/setup/actions/review-production-approval"]',
    );
    const corridorOptions = reviewForm.locator(
      'input[name="approvedAssetNetworkIds"]',
    );
    const overrideOption = await findFirstUncheckedOption(corridorOptions);
    const overrideLabel = await readCheckboxLabel(overrideOption);

    const optionCount = await corridorOptions.count();

    for (let index = 0; index < optionCount; index += 1) {
      const option = corridorOptions.nth(index);
      if (await option.isChecked()) {
        await option.uncheck();
      }
    }

    await overrideOption.check();
    await reviewForm
      .getByLabel("Review note")
      .fill("Approving with a narrowed corridor override for Playwright coverage.");
    await reviewForm.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("Production review recorded")).toBeVisible();
    await expect(
      page.getByText("Approved production access for 'atlas-consumer-demo'."),
    ).toBeVisible();

    const selectedPartnerCard = page.locator(".detail-card").filter({
      hasText: "Selected partner",
    });
    await expect(selectedPartnerCard).toContainText("atlas-consumer-demo");
    await expect(selectedPartnerCard).toContainText("Latest approved scope");
    await expect(selectedPartnerCard).toContainText(overrideLabel);
    await expect(selectedPartnerCard).toContainText("1 granted");

    const corridorControlsCard = page.locator(".detail-card").filter({
      hasText: "Production corridor controls",
    });
    await corridorControlsCard
      .getByRole("button", { name: "Revoke corridor" })
      .first()
      .click();

    await expect(page.getByText("Production corridor revoked")).toBeVisible();
    await expect(
      page.getByText("Revoked production corridor access for 'atlas-consumer-demo'."),
    ).toBeVisible();
    await expect(selectedPartnerCard).toContainText("0 granted");

    const grantCorridorForm = corridorControlsCard.locator(
      'form[action="/setup/actions/update-production-corridor"]',
    ).last();
    const corridorSelect = grantCorridorForm.locator('select[name="assetNetworkId"]');
    const optionLocator = corridorSelect.locator('option:not([value=""])').first();
    const corridorValue = await optionLocator.getAttribute("value");
    expect(corridorValue).toBeTruthy();

    await corridorSelect.selectOption(corridorValue!);
    await grantCorridorForm
      .getByLabel("Admin note")
      .fill("Re-granting corridor access after approval review.");
    await grantCorridorForm.getByRole("button", { name: "Grant corridor" }).click();

    await expect(page.getByText("Production corridor granted")).toBeVisible();
    await expect(
      page.getByText("Granted production corridor access for 'atlas-consumer-demo'."),
    ).toBeVisible();
    await expect(selectedPartnerCard).toContainText("1 granted");
    await expect(corridorControlsCard).toContainText(
      "Re-granting corridor access after approval review.",
    );
  });
});

async function signInAdminSetup(page: Page) {
  await openAdminSetupWorkspace(page);
}

async function findFirstUncheckedOption(options: Locator) {
  const count = await options.count();

  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);

    if (!(await option.isChecked())) {
      return option;
    }
  }

  throw new Error("Expected at least one unchecked corridor option for override coverage.");
}

async function readCheckboxLabel(option: Locator) {
  const labelText = await option.locator("xpath=ancestor::label[1]").textContent();
  const normalizedLabel = labelText?.replace(/\s+/g, " ").trim();

  if (!normalizedLabel) {
    throw new Error("Could not read the corridor label for the approval override option.");
  }

  return normalizedLabel;
}
