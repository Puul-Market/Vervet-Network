import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  revokePartnerApiCredential,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const credentialId = readRequiredTextField(formData.get("credentialId"));

  if (!credentialId) {
    await setDashboardFlash({
      level: "error",
      title: "Credential revocation failed",
      message: "A credential identifier is required.",
    });

    return NextResponse.redirect(new URL("/access/api-keys", request.url), 303);
  }

  try {
    const credential = await revokePartnerApiCredential(
      session.accessToken,
      credentialId,
    );

    await setDashboardFlash({
      level: "success",
      title: "Credential revoked",
      message: `Credential '${credential.label}' has been revoked.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Credential revocation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/api-keys", request.url), 303);
}
