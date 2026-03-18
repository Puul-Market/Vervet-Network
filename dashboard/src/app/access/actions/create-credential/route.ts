import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { isCredentialScopeValue, readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  type CredentialScope,
  humanizeDashboardError,
  issuePartnerApiCredential,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const label = readRequiredTextField(formData.get("label"));
  const scopes = formData
    .getAll("scopes")
    .filter(isCredentialScopeValue) as CredentialScope[];

  if (!label || scopes.length === 0) {
    await setDashboardFlash({
      level: "error",
      title: "Credential issuance failed",
      message: "A label and at least one supported scope are required.",
    });

    return NextResponse.redirect(new URL("/access/api-keys", request.url), 303);
  }

  try {
    const credential = await issuePartnerApiCredential(session.accessToken, {
      label,
      scopes,
    });

    await setDashboardFlash({
      level: "success",
      title: "Credential issued",
      message: `Credential '${credential.label}' is ready. The secret is shown once below.`,
      secretLabel: "Credential secret",
      secretValue: credential.secret,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Credential issuance failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/access/api-keys", request.url), 303);
}
