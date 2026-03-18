import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import { readRequiredTextField } from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  testWebhookEndpoint,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const endpointId = readRequiredTextField(formData.get("endpointId"));
  const redirectTo = readRequiredTextField(formData.get("redirectTo"));

  if (!endpointId) {
    await setDashboardFlash({
      level: "error",
      title: "Test failed",
      message: "Endpoint id is required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/webhooks", request.url),
      303,
    );
  }

  try {
    const result = await testWebhookEndpoint(session.accessToken, endpointId);

    await setDashboardFlash({
      level: result.ok ? "success" : "error",
      title: result.ok ? "Endpoint test succeeded" : "Endpoint test failed",
      message: result.ok
        ? `Endpoint responded with ${result.responseCode ?? "no status code"}.`
        : result.responseBody || "The endpoint did not return a successful response.",
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Test failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? `/webhooks/${endpointId}`, request.url),
    303,
  );
}
