import { NextResponse } from "next/server";
import {
  readIsoDateTimeField,
  readRequiredEnumField,
  readRequiredTextField,
} from "@/lib/form-input";
import { setDashboardFlash } from "@/lib/flash";
import { clearAdminSetupSession, getAdminSetupSession } from "@/lib/session";
import {
  DashboardAdminAuthError,
  humanizeDashboardError,
  registerInitialSigningKey,
  type SigningKeyAlgorithm,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getAdminSetupSession();

  if (!session) {
    return NextResponse.redirect(new URL("/setup", request.url), 303);
  }

  const formData = await request.formData();
  const partnerSlug = readRequiredTextField(formData.get("partnerSlug"));
  const keyId = readRequiredTextField(formData.get("keyId"));
  const publicKeyPem = readRequiredTextField(formData.get("publicKeyPem"));
  const validFrom = readIsoDateTimeField(formData.get("validFrom"), true);
  const validTo = readIsoDateTimeField(formData.get("validTo"), false);
  const algorithm = readRequiredEnumField<SigningKeyAlgorithm>(
    formData.get("algorithm"),
  );

  if (
    !partnerSlug ||
    !keyId ||
    !publicKeyPem ||
    !validFrom ||
    !algorithm
  ) {
    await setDashboardFlash({
      level: "error",
      title: "Signing-key registration failed",
      message:
        "Partner slug, key id, algorithm, public key PEM, and a valid start time are required.",
    });

    return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
  }

  try {
    const signingKey = await registerInitialSigningKey(
      session.adminToken,
      {
        algorithm,
        keyId,
        partnerSlug,
        publicKeyPem,
        validFrom,
        ...(validTo ? { validTo } : {}),
      },
    );

    await setDashboardFlash({
      level: "success",
      title: "Signing key registered",
      message: `Signing key '${signingKey.keyId}' is active for partner '${partnerSlug}'.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAdminAuthError) {
      await clearAdminSetupSession();
      await setDashboardFlash({
        level: "error",
        title: "Admin setup expired",
        message: error.message,
      });

      return NextResponse.redirect(new URL("/setup", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Signing-key registration failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(buildSetupRedirectUrl(request.url, partnerSlug), 303);
}

function buildSetupRedirectUrl(
  requestUrl: string,
  partnerSlug: string | null,
): URL {
  const url = new URL("/setup", requestUrl);

  if (partnerSlug) {
    url.searchParams.set("partnerSlug", partnerSlug);
  }

  return url;
}
