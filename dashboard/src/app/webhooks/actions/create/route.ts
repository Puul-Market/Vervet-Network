import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredEnumField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  createWebhookEndpoint,
  DashboardAuthError,
  humanizeDashboardError,
  type WebhookEventType,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const label = readRequiredField(formData.get("label"));
  const url = readRequiredField(formData.get("url"));
  const eventTypes = formData
    .getAll("eventTypes")
    .map((value) => readRequiredEnumField<WebhookEventType>(value))
    .filter((value): value is WebhookEventType => value !== null);

  if (!label || !url || eventTypes.length === 0) {
    await setDashboardFlash({
      level: "error",
      title: "Webhook creation failed",
      message:
        "Label, URL, and at least one event type are required to create a webhook endpoint.",
    });

    return NextResponse.redirect(new URL("/webhooks", request.url), 303);
  }

  try {
    const endpoint = await createWebhookEndpoint(session.accessToken, {
      label,
      url,
      eventTypes,
    });

    await setDashboardFlash({
      level: "success",
      title: "Endpoint created",
      message: `Webhook endpoint '${endpoint.label}' is active and ready for deliveries.`,
      secretLabel: "Signing secret",
      secretValue: endpoint.signingSecret,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Webhook creation failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(new URL("/webhooks", request.url), 303);
}

function readRequiredField(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}
