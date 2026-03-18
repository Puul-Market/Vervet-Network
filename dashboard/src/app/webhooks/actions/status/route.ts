import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readOptionalEnumField, readOptionalTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  disableWebhookEndpoint,
  humanizeDashboardError,
  updateWebhookEndpoint,
  type WebhookStatus,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const endpointId = readRequiredField(formData.get("endpointId"));
  const nextStatus = readOptionalEnumField<WebhookStatus>(formData.get("nextStatus"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!endpointId || !nextStatus) {
    await setDashboardFlash({
      level: "error",
      title: "Endpoint update failed",
      message: "Endpoint ID and next status are required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/webhooks", request.url),
      303,
    );
  }

  try {
    const endpoint =
      nextStatus === "DISABLED"
        ? await disableWebhookEndpoint(session.accessToken, endpointId)
        : await updateWebhookEndpoint(session.accessToken, endpointId, {
            status: nextStatus,
          });

    await setDashboardFlash({
      level: "success",
      title: "Endpoint updated",
      message: `Webhook endpoint '${endpoint.label}' is now ${endpoint.status.toLowerCase()}.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Endpoint update failed",
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
