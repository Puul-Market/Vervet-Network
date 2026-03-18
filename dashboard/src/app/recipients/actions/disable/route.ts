import { NextResponse } from "next/server";
import { setDashboardFlash } from "@/lib/flash";
import {
  readOptionalTextField,
  readRequiredTextField,
} from "@/lib/form-input";
import { clearDashboardSession, getDashboardSession } from "@/lib/session";
import {
  DashboardAuthError,
  disableRecipient,
  humanizeDashboardError,
} from "@/lib/vervet-api";

export async function POST(request: Request) {
  const session = await getDashboardSession();

  if (!session) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  const formData = await request.formData();
  const recipientId = readRequiredTextField(formData.get("recipientId"));
  const redirectTo = readOptionalTextField(formData.get("redirectTo"));

  if (!recipientId) {
    await setDashboardFlash({
      level: "error",
      title: "Recipient disable failed",
      message: "Recipient id is required.",
    });

    return NextResponse.redirect(
      new URL(redirectTo ?? "/recipients", request.url),
      303,
    );
  }

  try {
    const recipient = await disableRecipient(session.accessToken, recipientId);

    await setDashboardFlash({
      level: "success",
      title: "Recipient disabled",
      message: `${recipient.displayName ?? recipient.externalRecipientId} is no longer active.`,
    });
  } catch (error: unknown) {
    if (error instanceof DashboardAuthError) {
      await clearDashboardSession();
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    await setDashboardFlash({
      level: "error",
      title: "Recipient disable failed",
      message: humanizeDashboardError(error),
    });
  }

  return NextResponse.redirect(
    new URL(redirectTo ?? "/recipients", request.url),
    303,
  );
}
