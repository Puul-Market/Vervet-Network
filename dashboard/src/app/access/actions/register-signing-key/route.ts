import { NextResponse } from "next/server";
import {
  readIsoDateTimeField,
  readRequiredEnumField,
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { setDashboardFlash } from "@/lib/flash";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  registerPartnerSigningKey,
  type SigningKeyAlgorithm,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const keyId = readRequiredTextField(formData.get("keyId"));
  const publicKeyPem = readRequiredTextField(formData.get("publicKeyPem"));
  const validFrom = readIsoDateTimeField(formData.get("validFrom"), true);
  const validTo = readIsoDateTimeField(formData.get("validTo"), false);
  const algorithm = readRequiredEnumField<SigningKeyAlgorithm>(
    formData.get("algorithm"),
  );

  if (
    !keyId ||
    !publicKeyPem ||
    !validFrom ||
    !algorithm
  ) {
    await setDashboardFlash({
      level: "error",
      title: "Signing-key registration failed",
      message:
        "Key id, algorithm, public key PEM, and a valid start time are required.",
    });

    return NextResponse.redirect(
      new URL("/access/signing-keys", request.url),
      303,
    );
  }

  try {
    const signingKey = await registerPartnerSigningKey(session.accessToken, {
      algorithm,
      keyId,
      publicKeyPem,
      validFrom,
      ...(readOptionalTextField(formData.get("validTo")) && validTo
        ? {
            validTo,
          }
        : {}),
    });

    await setDashboardFlash({
      level: "success",
      title: "Signing key registered",
      message: `Signing key '${signingKey.keyId}' is active and available for attestation verification.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Signing-key registration failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL("/access/signing-keys", request.url),
    303,
  );
}
