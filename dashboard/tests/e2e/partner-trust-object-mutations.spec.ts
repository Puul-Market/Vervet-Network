import { expect, test, type Page } from "@playwright/test";

const ownerAccount = {
  email: "ops@ivorypay.demo",
  password: "Vervet-Ivorypay-2026!",
} as const;

test.describe("partner trust-object mutation flows", () => {
  test.describe.configure({ mode: "serial" });

  test("owner can create and disable a recipient and manage destination lifecycle", async ({
    page,
  }) => {
    await signIn(page, ownerAccount);
    await page.goto("/recipients");

    const recipientKey = uniqueValue("playwright-recipient");
    const displayName = `Playwright ${recipientKey}`;
    const identifier = `${recipientKey}@ivorypay`;

    await page.getByLabel("External recipient id").fill(recipientKey);
    await page.getByLabel("Display name").fill(displayName);
    await page.getByLabel("Primary identifier").fill(identifier);
    await page.getByRole("button", { name: "Create Recipient" }).click();

    await expect(page.getByText("Recipient created")).toBeVisible();
    await expect(page.getByText(`${displayName} is now in the registry.`)).toBeVisible();

    const recipientRow = page.locator("tr").filter({ hasText: displayName });
    await expect(recipientRow).toBeVisible();
    await recipientRow.getByRole("link", { name: "View" }).click();

    await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

    const recipientId = extractTrailingPathSegment(page.url());

    await page.getByRole("link", { name: "Add Destination" }).click();
    await page.waitForURL(`**/destinations?recipientId=${recipientId}`);

    const initialAddress = uniqueEvmAddress("a");
    const createDestinationForm = page.locator(
      'form[action="/destinations/actions/create"]',
    );

    await createDestinationForm
      .locator('select[name="recipientId"]')
      .selectOption(recipientId);
    await createDestinationForm
      .locator('select[name="chain"]')
      .selectOption("ethereum");
    await createDestinationForm.locator('select[name="asset"]').selectOption("USDC");
    await createDestinationForm.getByLabel("Address").fill(initialAddress);
    await createDestinationForm
      .getByRole("button", { name: "Create Destination" })
      .click();

    await expect(page.getByText("Destination created")).toBeVisible();
    await expect(
      page.getByText(`Destination ${initialAddress} is now pending signed attestation coverage.`),
    ).toBeVisible();

    const createdDestinationRow = page.locator("tr").filter({
      hasText: displayName,
    });
    await expect(createdDestinationRow).toBeVisible();
    await createdDestinationRow.getByRole("link", { name: "View" }).click();

    await expect(page.getByRole("heading", { name: "Destination Detail" })).toBeVisible();

    const originalDestinationId = extractTrailingPathSegment(page.url());
    const replacementAddress = uniqueEvmAddress("b");

    await page.getByLabel("Replacement address").fill(replacementAddress);
    await page.getByRole("button", { name: "Replace Destination" }).click();

    await expect(page.getByText("Destination replaced")).toBeVisible();
    await expect(
      page.getByText(
        `Replacement destination ${replacementAddress} is now pending attestation coverage.`,
      ),
    ).toBeVisible();

    await page.goto(`/destinations?recipientId=${recipientId}&status=PENDING`);

    const replacementRow = page.locator("tr").filter({
      hasText: displayName,
    });
    await expect(replacementRow).toBeVisible();
    await replacementRow.getByRole("link", { name: "View" }).click();

    await expect(page.getByRole("heading", { name: replacementAddress })).toBeVisible();

    const replacementDestinationId = extractTrailingPathSegment(page.url());
    expect(replacementDestinationId).not.toBe(originalDestinationId);

    await page.getByRole("button", { name: "Revoke Destination" }).click();

    await expect(page.getByText("Destination revoked")).toBeVisible();
    await expect(
      page.getByText(`Destination ${replacementAddress} is now revoked.`),
    ).toBeVisible();
    await expect(page.getByText("REVOKED").first()).toBeVisible();

    await page.goto(`/recipients/${recipientId}`);
    await page.getByRole("button", { name: "Disable Recipient" }).click();

    await expect(page.getByText("Recipient disabled")).toBeVisible();
    await expect(page.getByText(`${displayName} is no longer active.`)).toBeVisible();
    await expect(page.getByText("SUSPENDED").first()).toBeVisible();
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

function uniqueValue(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function uniqueEvmAddress(padCharacter: string) {
  const fragment = `${Date.now().toString(16)}${Math.random()
    .toString(16)
    .slice(2, 18)}`.replace(/[^a-f0-9]/gi, "");

  return `0x${fragment.padEnd(40, padCharacter).slice(0, 40)}`;
}

function extractTrailingPathSegment(url: string) {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const trailingSegment = segments.at(-1);

  if (!trailingSegment) {
    throw new Error(`Could not extract trailing path segment from '${url}'.`);
  }

  return trailingSegment;
}
