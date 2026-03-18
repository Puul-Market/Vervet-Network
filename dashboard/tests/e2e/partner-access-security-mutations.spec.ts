import { generateKeyPairSync } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const ownerAccount = {
  email: "ops@ivorypay.demo",
  password: "Vervet-Ivorypay-2026!",
} as const;

const developerAccount = {
  email: "developer@ivorypay.demo",
  password: "Vervet-Ivorypay-Developer-2026!",
} as const;

test.describe("partner access and security mutations", () => {
  test.describe.configure({ mode: "serial" });

  test("developer can register and revoke a signing key", async ({ page }) => {
    await signIn(page, developerAccount);
    await page.goto("/access/signing-keys");

    const keyId = uniqueValue("playwright-signing-key");
    const signingKeyForm = page.locator(
      'form[action="/access/actions/register-signing-key"]',
    );

    await signingKeyForm.getByLabel("Key id").fill(keyId);
    await signingKeyForm
      .getByLabel("Public key PEM")
      .fill(buildPublicKeyPem(keyId));
    await signingKeyForm
      .getByLabel("Valid from")
      .fill(buildDateTimeLocalValue(10));
    await signingKeyForm
      .getByRole("button", { name: "Register Signing Key" })
      .click();

    await expect(page.getByText("Signing key registered")).toBeVisible();
    await expect(
      page.getByText(
        `Signing key '${keyId}' is active and available for attestation verification.`,
      ),
    ).toBeVisible();

    const keyRow = page.locator("tr").filter({ hasText: keyId });
    await expect(keyRow).toBeVisible();

    await keyRow.getByRole("button", { name: "Revoke" }).click();

    await expect(page.getByText("Signing key revoked")).toBeVisible();
    await expect(
      page.getByText(`Signing key '${keyId}' has been revoked.`),
    ).toBeVisible();
    await expect(keyRow.getByText("REVOKED")).toBeVisible();
  });

  test("owner can update security settings and see them persist", async ({
    page,
  }) => {
    await signIn(page, ownerAccount);
    await page.goto("/access/security");

    const sessionIdleTimeoutMinutes = "77";
    const credentialRotationDays = "45";
    const ipAllowlist = "203.0.113.0/24\n198.51.100.7/32";

    await page
      .getByLabel("Session idle timeout (minutes)")
      .fill(sessionIdleTimeoutMinutes);
    await page
      .getByLabel("Credential rotation (days)")
      .fill(credentialRotationDays);
    await page.getByLabel("IP allowlist").fill(ipAllowlist);
    await page.getByLabel("Require MFA for partner users").check();
    await page.getByRole("button", { name: "Save Security Settings" }).click();

    await expect(page.getByText("Security settings updated")).toBeVisible();
    await expect(
      page.getByText("Partner security defaults are now saved."),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByLabel("Session idle timeout (minutes)"),
    ).toHaveValue(sessionIdleTimeoutMinutes);
    await expect(
      page.getByLabel("Credential rotation (days)"),
    ).toHaveValue(credentialRotationDays);
    const ipAllowlistField = page.getByLabel("IP allowlist");
    await expect(ipAllowlistField).toContainText("203.0.113.0/24");
    await expect(ipAllowlistField).toContainText("198.51.100.7/32");
    await expect(
      page.getByLabel("Require MFA for partner users"),
    ).toBeChecked();

    await expect(
      page.locator(".summary-card").filter({ hasText: "Session timeout" }),
    ).toContainText("77 min");
    await expect(
      page.locator(".summary-card").filter({ hasText: "Rotation policy" }),
    ).toContainText("45 days");
    await expect(
      page.locator(".summary-card").filter({ hasText: "MFA enforcement" }),
    ).toContainText("Enabled");
    await expect(
      page.locator(".summary-card").filter({ hasText: "IP allowlist entries" }),
    ).toContainText("2");
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

function buildPublicKeyPem() {
  const { publicKey } = generateKeyPairSync("ed25519");

  return publicKey.export({ format: "pem", type: "spki" }).toString();
}

function buildDateTimeLocalValue(minutesFromNow: number) {
  const value = new Date(Date.now() + minutesFromNow * 60_000);
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
