import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readOptionalTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  rotateWebhookSigningSecret,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const endpointId = readRequiredField(formData.get("endpointId"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!endpointId) {
    await setDashboardFlash({
      level: "error",
      title: "Secret rotation failed",
      message: "Endpoint ID is required to rotate the signing secret.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/webhooks", request.url),
      303,
    );
  }

  try {
    const endpoint = await rotateWebhookSigningSecret(
      session.accessToken,
      endpointId,
    );

    await setDashboardFlash({
      level: "success",
      title: "Signing secret rotated",
      message: `Webhook endpoint '${endpoint.label}' now uses signing secret version ${endpoint.signingSecretVersion}.`,
      secretLabel: "Rotated signing secret",
      secretValue: endpoint.signingSecret,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Secret rotation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? "/webhooks", request.url),
    303,
  );
}

function readRequiredField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
