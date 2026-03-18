import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  revokePartnerSigningKey,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const signingKeyId = readRequiredTextField(formData.get("signingKeyId"));

  if (!signingKeyId) {
    await setDashboardFlash({
      level: "error",
      title: "Signing-key revocation failed",
      message: "A signing key identifier is required.",
    });

    return NextResponse.redirect(
      new URL("/access/signing-keys", request.url),
      303,
    );
  }

  try {
    const signingKey = await revokePartnerSigningKey(
      session.accessToken,
      signingKeyId,
    );

    await setDashboardFlash({
      level: "success",
      title: "Signing key revoked",
      message: `Signing key '${signingKey.keyId}' has been revoked.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Signing-key revocation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL("/access/signing-keys", request.url),
    303,
  );
}
