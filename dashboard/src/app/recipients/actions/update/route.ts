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
  updateRecipient,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const recipientId = readRequiredTextField(formData.get("recipientId"));
  const displayName = readOptionalTextField(formData.get("displayName"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!recipientId || !displayName) {
    await setDashboardFlash({
      level: "error",
      title: "Recipient update failed",
      message: "Recipient id and a display name are required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/recipients", request.url),
      303,
    );
  }

  try {
    const recipient = await updateRecipient(session.accessToken, recipientId, {
      displayName,
    });

    await setDashboardFlash({
      level: "success",
      title: "Recipient updated",
      message: `${recipient.externalRecipientId} now shows as ${recipient.displayName}.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Recipient update failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? `/recipients/${recipientId}`, request.url),
    303,
  );
}
