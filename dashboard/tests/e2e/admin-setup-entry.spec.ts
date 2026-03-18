import { expect, test } from "@playwright/test";

const adminSetupToken = "local-admin-token";

test.describe("admin setup entry", () => {
  test("valid admin token opens the internal review workspace", async ({
    page,
  }) => {
    await page.goto("/setup");

    await expect(
      page.getByRole("heading", {
        name: "Bootstrap a partner without leaving the dashboard.",
      }),
    ).toBeVisible();

    await page.getByLabel("Admin setup token").fill(adminSetupToken);
    await page.getByRole("button", { name: "Open setup" }).click();

    await expect(
      page.getByRole("heading", {
        name: "Internal partner review workspace",
      }),
    ).toBeVisible();
  });

  test("invalid admin token shows an inline error and stays on entry form", async ({
    page,
  }) => {
    await page.goto("/setup");
    await page.getByLabel("Admin setup token").fill("invalid-admin-token");
    await page.getByRole("button", { name: "Open setup" }).click();

    await expect(page.locator(".form-error[role='alert']")).toContainText(
      "Admin setup is not available.",
    );
    await expect(
      page.getByRole("heading", {
        name: "Bootstrap a partner without leaving the dashboard.",
      }),
    ).toBeVisible();
  });
});
