import { expect, test, type Page } from "@playwright/test";

const demoAccounts = {
  combinedProduction: {
    email: "ops@ivorypay.demo",
    password: "Vervet-Ivorypay-2026!",
  },
  dataOnly: {
    email: "ops@trustwallet.demo",
    password: "Vervet-TrustWallet-2026!",
  },
  consumerOnly: {
    email: "ops@consumer.demo",
    password: "Vervet-Consumer-2026!",
  },
  degraded: {
    email: "ops@degraded.demo",
    password: "Vervet-Degraded-2026!",
  },
  restricted: {
    email: "ops@restricted.demo",
    password: "Vervet-Restricted-2026!",
  },
} as const;

test.describe("partner-state matrix", () => {
  test("consumer-only partner hides registry modules and shows registry availability messaging", async ({
    page,
  }) => {
    await signIn(page, demoAccounts.consumerOnly);

    await expect(
      page.getByText("API consumer enabled · Trust data disabled"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Recipients", exact: true }),
    ).toHaveCount(0);

    await page.goto("/recipients");

    await expect(
      page.getByRole("heading", {
        name: "Recipient registry is not enabled for this organization",
      }),
    ).toBeVisible();
  });

  test("data-only partner exposes registry and data-feed operations without sender-side API posture", async ({
    page,
  }) => {
    await signIn(page, demoAccounts.dataOnly);

    await expect(
      page.getByText("API consumer disabled · Trust data enabled"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Recipients", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Health", exact: true }),
    ).toBeVisible();

    await page.goto("/data-feed-health");

    await expect(
      page.getByRole("heading", { name: "Data Feed Health" }),
    ).toBeVisible();
    await expect(page.getByText("Current feed status")).toBeVisible();
  });

  test("combined production partner shows production readiness on overview", async ({
    page,
  }) => {
    await signIn(page, demoAccounts.combinedProduction);

    await expect(
      page.getByRole("heading", { name: "Overview" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Production approved across \d+ corridors?/).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Production corridors: \d+/).first(),
    ).toBeVisible();
  });

  test("degraded partner surfaces degraded feed state across overview and feed health", async ({
    page,
  }) => {
    await signIn(page, demoAccounts.degraded);

    await expect(page.getByText("Feed health: Degraded").first()).toBeVisible();
    await expect(page.getByText("Degraded feed health").first()).toBeVisible();

    await page.goto("/data-feed-health");

    await expect(
      page.locator(".status-badge.status-degraded").first(),
    ).toBeVisible();
    await expect(page.getByText("Current feed status")).toBeVisible();
  });

  test("restricted partner can sign in but cannot execute live resolution or use sandbox", async ({
    page,
  }) => {
    await signIn(page, demoAccounts.restricted);

    await expect(
      page.getByRole("link", { name: "Sandbox", exact: true }),
    ).toHaveCount(0);

    await page.goto("/resolution/by-recipient");

    await expect(
      page.getByRole("heading", {
        name: "Resolution execution is currently unavailable",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Enable sandbox or production access for this organization before running live recipient resolution requests.",
      ),
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
