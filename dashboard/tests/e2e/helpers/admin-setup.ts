import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const adminSessionCookieName = "vervet_dashboard_admin_session";
const defaultAdminSetupToken = "local-admin-token";
const dashboardSessionSecret = resolveDashboardSessionSecret();

export async function openAdminSetupWorkspace(
  page: Page,
  adminToken = defaultAdminSetupToken,
) {
  await page.context().addCookies([
    {
      name: adminSessionCookieName,
      value: sealCookiePayload({ adminToken }),
      domain: "localhost",
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.goto("/setup");
  await expect(
    page.getByRole("heading", { name: "Internal partner review workspace" }),
  ).toBeVisible();
}

function resolveDashboardSessionSecret(): string {
  const envSecret = process.env.DASHBOARD_SESSION_SECRET;

  if (typeof envSecret === "string" && envSecret.trim().length >= 32) {
    return envSecret.trim();
  }

  const envFileContents = readFileSync(
    path.join(process.cwd(), ".env.local"),
    "utf8",
  );
  const match = envFileContents.match(
    /^DASHBOARD_SESSION_SECRET="?([^"\n]+)"?$/m,
  );

  if (!match || match[1].trim().length < 32) {
    throw new Error(
      "DASHBOARD_SESSION_SECRET is required to open the admin setup workspace in Playwright.",
    );
  }

  return match[1].trim();
}

function sealCookiePayload(payload: unknown): string {
  const sessionKey = createHash("sha256")
    .update(dashboardSessionSecret)
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}
