import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  humanizeDashboardError,
  replayWebhookDelivery,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const deliveryId = readRequiredTextField(formData.get("deliveryId"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!deliveryId) {
    await setDashboardFlash({
      level: "error",
      title: "Replay failed",
      message: "Delivery id is required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/webhooks/deliveries", request.url),
      303,
    );
  }

  try {
    const replay = await replayWebhookDelivery(session.accessToken, deliveryId);

    await setDashboardFlash({
      level: "success",
      title: "Replay queued",
      message: replay
        ? `Replay delivery ${replay.id} is now ${replay.status.toLowerCase()}.`
        : "The delivery was replayed.",
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Replay failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? `/webhooks/deliveries/${deliveryId}`, request.url),
    303,
  );
}
